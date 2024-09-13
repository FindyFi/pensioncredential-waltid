import { createServer } from 'node:http'
import { config, roles, apiHeaders } from './init.js'

// console.log(roles)

async function getOffer(path) {
  console.log(path)
  const issueUrl = `${config.issuer_api}/openid4vc/sdjwt/issue`
  const { default: credential } = await import('.' + path, { with: { type: "json" } });
  // console.log(credential)
  const issuerKey = JSON.parse(roles.issuer.key)
  issuerKey.jwk = JSON.parse(issuerKey.jwk)
  console.log(typeof roles.issuer.key)
  console.log(roles.issuer.key)
  credential.credentialSubject.id = "did:key:123"
  const requestBody = {
    "issuerKey": issuerKey,
    "issuerDid": roles.issuer.did,
    "credentialConfigurationId": "pensionCredential",
    "credentialData": credential,
    "mapping": {
      "id": "<uuid>",
      "issuer": {
        "type": ["Profile"],
        "id": "<issuerDid>",
        "name": roles.issuer.name,
      },
      "credentialSubject": {
        "id": "<subjectDid>"
      },
      "issuanceDate": "<timestamp>",
      "expirationDate": "<timestamp-in:31d>"
    },
    "selectiveDisclosure": {
      "fields": {
        "credentialSubject": {
          "sd": false,
          "children": {
            "fields": {
              "Pension": {
                "sd": true,
              },
              "Person": {
                "sd": false,
                "children": {
                  "fields": {
                    "person_identifier_code": { "sd": true },
                    "birth_date": { "sd": true },
                    "family_name_national_characters": { "sd": true },
                    "given_name_national_characters": { "sd": true },
                  }
                }
              }
            }
          }
        }
      }
    },
    "authenticationMethod": "PRE_AUTHORIZED"
  }
  console.log(JSON.stringify(requestBody, null, 1))
  const credParams = {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(requestBody)
  }
  // console.log(JSON.stringify(pensionCredential, null, 1))
  const resp = await fetch(issueUrl, credParams)
  if (resp.status != 200) {
    console.error(resp.status, issueUrl, JSON.stringify(credParams, null, 1))
    const err = await resp.json()
    console.log(err)
    throw new Error(err)
  }
  const credentialOffer = await resp.text()
  // console.log(resp.status, credentialOffer)
  return credentialOffer
}

const sendOffer = async function (req, res) {
  const path = new URL(`http://${config.server_host}${req.url}`).pathname
  if (path.includes('.json')) {
    res.setHeader("Content-Type", "text/plain")
    try {
      const offerUri = await getOffer(path)
      res.writeHead(200)
      res.end(offerUri)
      return false
    }
    catch(e) {
      res.writeHead(404)
      res.end(`${path} not found!`)
      // throw new Error(e)
      return false  
    }
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
  <h1>Heippa asiakas!</h1>
  <p id="instructions">Tunnistaudu palveluun valitsemalla henkilöllisyytesi valintalistasta:</p>
  <form id="idSelector">
   <select name="identity">
    <option value="pensioncredential.json">Totti Aalto (KAEL)</option>
    <option value="pensioncredential-provisional.json">Edwin Kelimtes (väliaikainen TKEL)</option>
    <option value="pensioncredential-disability.json">Joni Kai Hiltunen (TKEL)</option>
    <option value="pensioncredential-rehabilitation.json">Jonne Aapeli Setälä (KUKI)</option>
    <option value="pensioncredential-rehabilitation-expired.json">Annina von Forsellestes (päättynyt KUKI)</option>
   </select>
   <input type="submit" value="Vahvista" />
  </form>
  <canvas id="qrcode"></canvas>
  <p id="offer">Valmistellaan...</p>
  <script>

   const a = document.createElement('a')
   a.textContent = 'Kopioi todistetarjous leikepöydälle.'
   const o = document.querySelector('#offer')

   const f = document.querySelector('#idSelector')
   f.onsubmit = async function(e) {
    e.preventDefault()
    const file = this.identity.value
    console.log(file)
    const resp = await fetch(file)
    let qrUrl = await resp.text()
    if (resp.status != 200) {
      console.error(resp.status, file, qrUrl)
      document.querySelector('#instructions').textContent = 'Harmin paikka! Jotain meni pieleen...'
      o.textContent = ''
      return false
    }
    console.log(qrUrl)
    const canvas = document.getElementById("qrcode")
    const qr = QRCode.QRCodeBrowser(canvas)
    qr.setOptions({
      text: qrUrl,
      size: 256,
    })
    qr.draw()
    document.querySelector('#instructions').textContent = 'Skannaapa oheinen QR-koodi digikukkarollasi niin laitetaan sinne eläketodiste tulemaan...'
    a.href = qrUrl
    a.onclick = function(e) {
     e.preventDefault()
     console.log(qrUrl)
     console.log(this.href)
     try {
      navigator.clipboard.writeText(this.href)
     } catch (error) {
      console.error(error.message)
     }
    }
    // document.querySelector('#qrcode').onnoclick = () => {document.location.href = qrUrl}
    o.textContent = ''
    o.appendChild(a)
   }
  </script>
 </body>
</html>`)
}

const server = createServer(sendOffer)
server.listen(config.issuer_port, config.server_host, () => {
  console.log(`Server is running on http://${config.server_host}:${config.issuer_port}`)
})
