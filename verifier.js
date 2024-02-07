import { createServer } from 'node:http'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import { config } from './init.js'

const states = {}

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
  let id = fullUrl.searchParams.get('id') || uuidv4()
  console.log(fullUrl.pathname, fullUrl.searchParams.get('id'), id)
  switch (fullUrl.pathname) {
    case '/error':
      res.setHeader("Content-Type", "text/plain")
      res.writeHead(500)
      res.end(`Virhe käsiteltäessä tapahtumaa ${id}`)
      return false
    case '/success':
      const status = await getStatus(id)
      console.log(id, status)
      res.setHeader("Content-Type", "text/html")
      res.writeHead(200)
      res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <body style="text-align: center;">
  <h1>Tiedot tulivat perille!</h1>
  <p>Todisteen tarkistuksen tila: <strong>${status.verificationResult}</strong></p>
  <h2>Tiedot:</h2>
  <pre style="text-align: left">${JSON.stringify(status.policyResults?.results[1].policies[0].result.credentialSubject, null, 1)}</pre>
 </body>
</html>`)
      return false
  }
  if (req.url !== '/') {
    res.setHeader("Content-Type", "text/plain")
    res.writeHead(404)
    res.end(`Not Found`)
    return false
  }
  const credentialRequest = await createRequest(id)
  const dataURL = await QRCode.toDataURL(credentialRequest)

  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <body style="text-align: center;">
  <img src="https://cdn-assets-cloud.frontify.com/s3/frontify-cloud-files-us/eyJwYXRoIjoiZnJvbnRpZnlcL2FjY291bnRzXC8yZFwvMTkyOTA4XC9wcm9qZWN0c1wvMjQ5NjY1XC9hc3NldHNcLzAwXC80NTY4NzI2XC81MjA2ODk2MDdmZGRkYjBlMDEwMDhiOTVlMTk1OTRjMS0xNTk1NDI3ODE5LnN2ZyJ9:frontify:ToCDM7NDPWebZDLJcmAgDwA_EsA9XJBl3YroZI1XhA0?width=240" alt="HSL" />
  <h1>Heippa vahvasti tunnistettu asiakas!</h1>
  <p>Lähetäpä eläketodiste niin tsekataan, että sinulla on oikeus eläkealennukseen...</p>
  <a href="${credentialRequest}"><img src="${dataURL}" alt="Credential Request QR Code" /></a>
  <script>
   const uri = '${config.verifier_base}/status?id=${states[id]}'
   async functon checkstatus() {
    const resp = await fetch(uri)
    if (resp.status == 200) {
     const obj = await resp.json()
     console.log(obj)
    }
   }
   setInterval(checkStatus, 3000)
  </script>
 </body>
</html>`)
}

const server = createServer(requestCredential)
server.listen(config.verifier_port, config.server_host, () => {
    console.log(`Server is running on http://${config.server_host}:${config.verifier_port}`)
})
