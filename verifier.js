import { createServer } from 'node:http'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import auth from './auth.js'
import { apiHeaders, config } from './init.js'

const states = {}
const pollingInterval = 3 // seconds

async function createRequest(id) {
  const requestUrl = `${config.verifier_api}/openid4vc/verify`
  const requestBody = {
    "request_credentials": [
      {
        "format": config.credentialFormat,
        "vct": `${config.issuer_api}/${config.credentialType}`
      }
    ],
    "presentation_definition": {
      "id": uuidv4(),
      "input_descriptors": [{
        "id": `${config.credentialType}_${config.credentialFormat}`,
        "name": config.credentialType, // "Eläketodiste" (?)
        "purpose": "HSL:n eläkealennusoikeuden rekisteröintiin",
        "constraints": {
/*
          "fields": [
            {
              "path": [
                "$.credentialSubject.Person.given_name",
              ]
            },
            {
              "path": [
                "$.credentialSubject.Person.family_name",
              ]
            },
            {
              "path": [
                "$.credentialSubject.Person.birth_date",
              ]
            },
            {
              "path": [
                "$.credentialSubject.Pension.typeCode",
              ]
            },
          ],
 */
          "limit_disclosure": "required"
        }
      }]
    }
  }
  const requestParams = {
    method: 'POST',
    headers: Object.assign(apiHeaders, {
      "Accept": "*/*",
      "authorizeBaseUrl": "openid4vp://authorize",
      "responseMode": "direct_post",
      "successRedirectUri": `${config.verifier_base}/success?id=${id}`,
      "errorRedirectUri": `${config.verifier_base}/error?id=${id}`,
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(requestBody)
  }
  // console.log(JSON.stringify(requestBody, null, 1))
  // console.log(requestUrl, JSON.stringify(requestParams, null, 1))
  const resp = await fetch(requestUrl, requestParams)
  if (resp.status == 401) {
    const json = await auth()
    apiHeaders.Authorization = `Bearer ${json.access_token}`
    return createRequest(id) // possible recursion!
  }
  if (resp.status != 200) {
    console.log(resp.status, requestUrl, JSON.stringify(requestParams, null, 1))
  }
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
  table {
    max-width: 30em;
    margin: 1em auto;
  }
  th, td {
    text-align: left;
  }
  pre {
    background-color: black;
    color: green;
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

   const a = document.createElement('a')
   a.textContent = 'Kopioi todistepyyntö leikepöydälle.'
   a.href = '${credentialRequest}'
   a.style.display = 'block'
   a.onclick = function(e) {
    e.preventDefault()
    try {
     navigator.clipboard.writeText(this.href)
    } catch (error) {
     console.error(error.message)
    }
   }
   // document.querySelector('#qrcode').onnoclick = () => {document.location.href = qrUrl}
   const o = document.querySelector('#offer')
   c.appendChild(a)

   const uri = '/status?id=${id}'
   let timer
   async function checkStatus() {
    const resp = await fetch(uri)
    if (resp.status == 200) {
     const status = await resp.json()
     if (status.verificationResult) {
      clearInterval(timer)
      // console.log(JSON.stringify(status, null, 1))
      const policyResult = status.policyResults?.results?.at(0)
      const sdjwt = policyResult.credential
      // console.log(sdjwt)
      const disclosures = sdjwt.split('~')
      disclosures.splice(0, 1) // discard jwt
      disclosures.pop() // discard jwk
      // console.log(disclosures)
      const attributes = {}
      for (const d of disclosures) {
        try {
          const decoded = JSON.parse(atob(d))
          // console.log(decoded[1], decoded[2])
          attributes[decoded[1]] = decoded[2]
        }
        catch(e) {
          console.warn(\`Unable to parse disclosure '\${d}'\`)
          console.warn(e)
        }
      }
      // console.log(attributes)
      const html = \`<p>Todisteen tarkistuksen tila: <strong>\${status.verificationResult}</strong></p>
      <table>
      <tr><th>Hetu</th><td>\${attributes?.personal_administrative_number}</td></tr>
      <tr><th>Eläke</th><td>\${attributes?.Pension?.typeCode}</td></tr>
      <tr><th>Alkamispäivä</th><td>\${attributes?.Pension?.startDate}</td></tr>
      </table>
      <pre>\${JSON.stringify(status, null, 2)}</pre>\`
      c.innerHTML = html
      c.ondblclick = function(e) {
       this.classList.toggle('full')
      }
/*
      const t = document.createElement('table')
      let trs = \`<tr><th>Tarkastus</th><th>Tulos</th></tr>\`
      for (const policy of presentationPolicies) {
       trs += \`<tr><td>Verifiable Presentation: \${policy.description}</td><td><strong>\${policy.is_success}</strong></td></tr>\`
      }
      for (const policy of credentialPolicies) {
       trs += \`<tr><td>Verifiable Credentials: \${policy.description}</td><td><strong>\${policy.is_success}</strong></td></tr>\`
      }
      t.innerHTML = trs
      c.appendChild(t)
*/
     }
    }
   }
   timer = setInterval(checkStatus, ${pollingInterval * 1000} )
  </script>
 </body>
</html>`)
}

function renderCredential(sdjwt) {
  console.log(sdjwt)
  const disclosures = sdjwt.split('~')
  disclosures.splice(0, 1) // discard jwt
  disclosures.pop() // discard jwk
  const attributes = {}
  for (const d of disclosures) {
    const decoded = JSON.parse(atob(d))
    attributes[decoded[1]] = decoded[2]
  }
  const html = `<table>
    <tr><th>Hetu</th><td>${attributes?.personal_administrative_number}</td></tr>
    <tr><th>Eläke</th><td>${attributes?.Pension?.typeCode}</td></tr>
    <tr><th>Alkamispäivä</th><td>${attributes?.Pension?.startDate}</td></tr>
    </table>`
  return html
}

async function showSuccess(id, res) {
  console.log(`Success! Getting status for ${id}`)
  const status = await getStatus(id)
  console.log(JSON.stringify(status, null, 2))
  if (!status) {
    res.setHeader('Content-Type', 'text/plain; chaset="UTF-8"')
    res.writeHead(404)
    res.end(`Ei löytynyt tietoja tapahtumalle ${id}`)
    return false
  }
  const policyResult = status.policyResults?.results?.at(0)
  const sdjwt = policyResult.credential
  let html
  if (sdjwt) {
    html = `<h2>Tiedot:</h2>\n${renderCredential(sdjwt)}`
  }
  else {
    html = `<h2>VIRHE:</h2>\n<pre style="text-align: left">${JSON.stringify(status, null, 1)}</pre>`
  }
  console.log(id, status)
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <style>
  table {
   max-width: 30em;
   margin: 1em auto;
  }
  pre, th, td {
   text-align: left;
  }
 </style>
 <body style="text-align: center;">
  <h1>Tiedot tulivat perille!</h1>
  <p>Todisteen tarkistuksen tila: <strong>${status.verificationResult}</strong></p>
${html}
 </body>
</html>`)
}

async function getStatus(id) {
  if (!states[id]) {
    return false
  }
  const statusUrl = `${config.verifier_api}/openid4vc/session/${states[id]}`
  const resp = await fetch(statusUrl, { headers: apiHeaders })
  // console.log(statusUrl, resp.status)
  if (resp.status == 401) {
    const json = await auth()
    apiHeaders.Authorization = `Bearer ${json.access_token}`
    return getStatus(id) // possible recursion!
  }
  if (resp.status != 200) {
    console.error(JSON.stringify(await resp.text(), null, 1))
    return false
  }
  const verificationStatus = await resp.json()
  // console.log(statusUrl, resp.status, JSON.stringify(verificationStatus, null, 1))
  return verificationStatus
}

const handleRequests = async function (req, res) {
  const fullUrl = new URL(config.verifier_base + req.url)
  let id = fullUrl.searchParams.get('id')
  console.log(fullUrl.pathname, id)
  switch (fullUrl.pathname) {
    case '/error':
      res.setHeader('Content-Type', 'text/plain; chaset="UTF-8"')
      res.writeHead(500)
      res.end(`Virhe käsiteltäessä tapahtumaa ${id}`)
      return false
    case '/success':
      await showSuccess(id, res)
      return false
    case '/status':
      const status = await getStatus(id)
      if (!status) {
        res.setHeader('Content-Type', 'text/plain; chaset="UTF-8"')
        res.writeHead(500)
        res.end(`Virhe käsiteltäessä tapahtumaa ${id}`)
        return false
      }
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

const server = createServer(handleRequests)
server.listen(config.verifier_port, config.server_host, () => {
    console.log(`Server is running on http://${config.server_host}:${config.verifier_port}`)
})
