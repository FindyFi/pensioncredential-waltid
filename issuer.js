import { createServer } from 'node:http'
import pensionCredential from './pensioncredential.json' assert {'type': 'json'}
import { config, roles } from './init.js'

// console.log(roles)
// console.log(JSON.stringify(pensionCredential, null, 2))

async function getHolderDid() {
  const headers = {
    key: roles.issuer.key
  }
  const didResp = await fetch(`${config.issuer_api}/example-did`, { headers })
  const holder = {
    did: await didResp.text()
  }
  return holder
}

async function getOffer() {
  const holder = await getHolderDid()
  const issueUrl = `${config.issuer_api}/openid4vc/sdjwt/issue`
  const requestBody = {
    "issuanceKey": JSON.parse(roles.issuer.key),
    "issuerDid": roles.issuer.did,
    "vc": pensionCredential,
    "mapping": {
      "id": "<uuid>",
      "issuer": {
        "type": ["Profile"],
        "id": "<issuerDid>",
        "name": roles['issuer'].name,
      },
      "credentialSubject": {
        "id": holder.did
      },
      "issuanceDate": "<timestamp>",
      "expirationDate": "<timestamp-in:31d>"
    },
  }
  const credParams = {
    method: 'POST',
    headers: {
      "Accept-Encoding": "gzip, br, identity", // avoid deflate
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody)
  }
  // console.log(JSON.stringify(pensionCredential, null, 1))
  // console.log(issueUrl, JSON.stringify(credParams, null, 1))
  const resp = await fetch(issueUrl, credParams)
  const credentialOffer = await resp.text()
  // console.log(resp.status, credentialOffer)
  return credentialOffer
}

const sendOffer = async function (req, res) {
  const path = new URL(`http://${config.server_host}${req.url}`).pathname
  if (path !== '/') {
    res.setHeader("Content-Type", "text/plain")
    res.writeHead(404)
    res.end(`Not Found`)
    return false
  }
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <title>walt-identity myöntää eläketodisteen</title>
 <script src="https://unpkg.com/@qrcode-js/browser"></script>
 <style>
  #qrcode {
    margin: 1em auto;
  }
 </style>
 <body style="text-align: center;">
  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/6/67/Kela_suomi_kela-1-.jpg/220px-Kela_suomi_kela-1-.jpg" alt="Kela" />
  <h1>Heippa vahvasti tunnistettu asiakas!</h1>
  <p>Skannaapa oheinen QR-koodi digikukkarollasi niin laitetaan sinne eläketodistetta tulemaan...</p>
  <canvas id="qrcode"></canvas>
  <p id="offer">Valmistellaan...</p>
  <script>
   let qrUrl = '${await getOffer()}'
   const canvas = document.getElementById("qrcode");
   const qr = QRCode.QRCodeBrowser(canvas);
   qr.setOptions({
     text: qrUrl,
     size: 256,
   })
   qr.draw()
   const a = document.createElement('a')
   a.textContent = 'Kopioi todistetarjous leikepöydälle.'
   a.href = qrUrl
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
   o.textContent = ''
   o.appendChild(a)
  </script>
  </body>
</html>`)
}

const server = createServer(sendOffer)
server.listen(config.issuer_port, config.server_host, () => {
  console.log(`Server is running on http://${config.server_host}:${config.issuer_port}`)
})
