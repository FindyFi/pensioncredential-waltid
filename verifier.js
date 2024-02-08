import { createServer } from 'node:http'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import { config } from './init.js'

const states = {}
const pollingInterval = 3 // seconds

async function createRequest(id) {
  const requestUrl = `${config.verifier_api}/openid4vc/verify`
  const requestBody = {
    "request_credentials": [
      "PensionCredential"
    ]
  }
  const requestParams = {
    method: 'POST',
    headers: {
      "Accept": "*/*",
      "authorizeBaseUrl": "openid4vp://authorize",
      "responseMode": "direct_post",
      "successRedirectUri": `${config.verifier_base}/success?id=${id}`,
      "errorRedirectUri": `${config.verifier_base}/error?id=${id}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  }
  // console.log(JSON.stringify(requestBody, null, 1))
  // console.log(requestUrl, JSON.stringify(requestParams, null, 1))
  const resp = await fetch(requestUrl, requestParams)
  const credentialRequest = await resp.text()
  const url = new URL(credentialRequest)
  states[id] = url.searchParams.get('state')
  console.log(resp.status, credentialRequest, id)
  return credentialRequest
}

async function showRequest(res) {
  const id = uuidv4()
  const credentialRequest = await createRequest(id)
  const dataURL = await QRCode.toDataURL(credentialRequest)
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <style>
  pre {
    display: none;
    text-align: left;
  }
  #content.full pre {
    display: block;
  }
 </style>
 <body style="text-align: center;">
  <img src="https://cdn-assets-cloud.frontify.com/s3/frontify-cloud-files-us/eyJwYXRoIjoiZnJvbnRpZnlcL2FjY291bnRzXC8yZFwvMTkyOTA4XC9wcm9qZWN0c1wvMjQ5NjY1XC9hc3NldHNcLzAwXC80NTY4NzI2XC81MjA2ODk2MDdmZGRkYjBlMDEwMDhiOTVlMTk1OTRjMS0xNTk1NDI3ODE5LnN2ZyJ9:frontify:ToCDM7NDPWebZDLJcmAgDwA_EsA9XJBl3YroZI1XhA0?width=240" alt="HSL" />
  <h1>Heippa vahvasti tunnistettu asiakas!</h1>
  <div id="content">
   <p>Lähetäpä eläketodiste niin tsekataan, että sinulla on oikeus eläkealennukseen...</p>
   <a href="${credentialRequest}"><img src="${dataURL}" alt="Credential Request QR Code" /></a>
  </div>
  <script>
   const c = document.querySelector('#content')
   const uri = '/status?id=${id}'
   let timer
   async function checkStatus() {
    const resp = await fetch(uri)
    if (resp.status == 200) {
     const status = await resp.json()
     if (status.verificationResult) {
      console.log(JSON.stringify(status, null, 1))
      const credential = status.policyResults?.results?.at(1)?.policies?.at(0)?.result?.credentialSubject
      const html = \`<table>
      <tr><th>Nimi</th><td>\${credential.Person?.givenName} \${credential.Person?.familyName}</td></tr>
      <tr><th>Eläke</th><td>\${credential.Pension?.typeName} \${credential.Pension?.typeCode} \${credential.Pension?.statusCode || ''}</td></tr>
      </table>
      <pre>\${JSON.stringify(status, null, 2)}</pre>\`
      c.innerHTML = html
      c.ondblclick = function(e) {
        this.classList.toggle('full')
      }
      document.body.appendChild(pre)
      clearInterval(timer)
     }
    }
   }
   timer = setInterval(checkStatus, ${pollingInterval * 1000} )
  </script>
 </body>
</html>`)
}

function renderCredential(credential) {
  const html = `<table>
  <tr><th>Nimi</th><td>${credential.Person?.givenName} ${credential.Person?.familyName}</td></tr>
  <tr><th>Eläke</th><td>${credential.Pension?.typeName} ${credential.Pension?.typeCode} ${credential.Pension?.statusCode || ''}</td></tr>
  </table>`
  return html
}

async function showSuccess(id, res) {
  const status = await getStatus(id)
  const credential = status.policyResults?.results?.at(1)?.policies?.at(0)?.result?.credentialSubject
  let html
  if (credential) {
    html = `<h2>Tiedot:</h2>\n${renderCredential(credential)}`
  }
  else {
    html = `<h2>VIRHE:</h2>\n<pre>${JSON.stringify(status, null, 1)}</pre>`
  }
  console.log(id, status)
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
<meta charset="UTF-8">
<body style="text-align: center;">
<h1>Tiedot tulivat perille!</h1>
<p>Todisteen tarkistuksen tila: <strong>${status.verificationResult}</strong></p>
${html}
</body>
</html>`)
}

async function getStatus(id) {
  const statusUrl = `${config.verifier_api}/openid4vc/session/${states[id]}`
  const resp = await fetch(statusUrl)
  const verificationStatus = await resp.json()
  console.log(statusUrl, resp.status)
  // console.log(statusUrl, resp.status, JSON.stringify(verificationStatus, null, 1))
  return verificationStatus
}

const requestCredential = async function (req, res) {
  const fullUrl = new URL(config.verifier_base + req.url)
  let id = fullUrl.searchParams.get('id')
  console.log(fullUrl.pathname, fullUrl.searchParams.get('id'), id)
  switch (fullUrl.pathname) {
    case '/error':
      res.setHeader("Content-Type", "text/plain")
      res.writeHead(500)
      res.end(`Virhe käsiteltäessä tapahtumaa ${id}`)
      return false
    case '/success':
      await showSuccess(id, res)
      return false
    case '/status':
      const status = await getStatus(id)
      res.setHeader("Content-Type", "application/json")
      res.writeHead(200)
      res.end(JSON.stringify(status))
      return false
  }
  if (req.url !== '/') {
    res.setHeader("Content-Type", "text/plain")
    res.writeHead(404)
    res.end(`Not Found`)
    return false
  }
  await showRequest(res)
}

const server = createServer(requestCredential)
server.listen(config.verifier_port, config.server_host, () => {
    console.log(`Server is running on http://${config.server_host}:${config.verifier_port}`)
})
