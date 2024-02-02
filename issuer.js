import { createServer, request } from 'node:http'
import QRCode from 'qrcode'
import { v4 as uuidv4 } from 'uuid'
import { pensionCredential } from './credential.js'
import { config, roles } from './init.js'

// console.log(roles)
// console.log(JSON.stringify(pensionCredential, null, 2))

const headers = {
  key: roles.issuer.key
}
const didResp = await fetch(`${config.issuer_api}/example-did`, { headers })
const holder = {
  did: await didResp.text()
}

const issueUrl = `${config.issuer_api}/openid4vc/sdjwt/issue`
const requestBody = {
  "issuanceKey": JSON.parse(roles.issuer.key),
  "issuerDid": roles.issuer.did,
  "vc": pensionCredential,
  "mapping": {
    "id": uuidv4(),
    "issuer": {
      "id": roles.issuer.did
    },
    "credentialSubject": {
      "id": holder.did
    },
    "issuanceDate": new Date().toISOString(),
    "expirationDate": new Date().toISOString()
  },
  "selectiveDisclosure": {
    "fields": {
      "name": {
        "sd": true
      }
    }      
  }  
}
const credParams = {
  method: 'POST',
  headers: {
    "Accept-Encoding": "gzip, br, identity", // avoid deflate
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody)
}
console.log(JSON.stringify(pensionCredential, null, 1))
console.log(issueUrl, JSON.stringify(credParams, null, 1))
const resp = await fetch(issueUrl, credParams)
const credentialOffer = await resp.text()

console.log(resp.status, credentialOffer)

const sendOffer = async function (req, res) {
  if (req.url !== '/') {
    res.setHeader("Content-Type", "text/plain")
    res.writeHead(404)
    res.end(`Not Found`)
    return false
  }
  const dataURL = await QRCode.toDataURL(credentialOffer)
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html>
 <meta charset="UTF-8">
 <body style="text-align: center;">
  <img src="https://upload.wikimedia.org/wikipedia/en/thumb/6/67/Kela_suomi_kela-1-.jpg/220px-Kela_suomi_kela-1-.jpg" alt="Kela" />
  <h1>Heippa vahvasti tunnistettu asiakas!</h1>
  <p>Skannaapa oheinen QR-koodi digikukkarollasi niin laitetaan sinne eläketodistetta tulemaan...</p>
  <a href="${credentialOffer}"><img src="${dataURL}" alt="Credential Offer QR Code" /></a>
 </body>
</html>`)
}

const server = createServer(sendOffer)
server.listen(config.issuer_port, config.server_host, () => {
  console.log(`Server is running on http://${config.server_host}:${config.issuer_port}`)
})
