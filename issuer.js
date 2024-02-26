import { createServer } from 'node:http'
import pensionCredential from './pensioncredential.json' assert {'type': 'json'}
import { config, roles } from './init.js'

const credentialOfferPath = '/credentialOffer'

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
  if (path == credentialOfferPath) {
    const credentialOffer = await getOffer()
    const params = new URL(credentialOffer).searchParams
    const json = params.get('credential_offer')
    res.setHeader("Content-Type", "application/json")
    res.writeHead(200)
    res.end(json)
    return false
  }
  else if (path !== '/') {
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
  <canvas id="qrcode">
  <script>
  let qrUrl = '${await getOffer()}'
  const canvas = document.getElementById("qrcode");
  const qr = QRCode.QRCodeBrowser(canvas);
  const url = new URL(document.location)
  if (url.searchParams.get('credential_offer_uri')) {
    url.pathname = '${credentialOfferPath}'
    url.search = ''
    qrUrl = 'openid-credential-offer://?credential_offer_uri=' + encodeURIComponent(url)
  }
  console.log(qrUrl)
  qr.setOptions({
    text: qrUrl,
    size: 512,
  })
  qr.draw()
  document.querySelector('#qrcode').onclick = () => {document.location.href = qrUrl}
  </script>
  </body>
</html>`)
}

const server = createServer(sendOffer)
server.listen(config.issuer_port, config.server_host, () => {
  console.log(`Server is running on http://${config.server_host}:${config.issuer_port}`)
})
