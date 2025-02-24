import { createServer } from 'node:http'
import auth from './auth.js'
import { config, roles, apiHeaders } from './init.js'

// console.log(roles)

async function getOffer(path) {
  console.log(path)
  const issueUrl = `${config.issuer_api}/openid4vc/sdjwt/issue`
  const { default: credential } = await import('.' + path, { with: { type: "json" } });
  // console.log(credential)
  credential.credentialSubject.id = credential.credentialSubject.Person.personal_administrative_number
  const requestBody = {
    "issuerKey": JSON.parse(roles.issuer.key),
    "issuerDid": roles.issuer.did,
    "credentialConfigurationId": `${config.credentialType}_${config.credentialFormat}`,
    "credentialData": credential,
    "mapping": {
      "id": "<uuid>",
      "issuer": {
        "type": ["Profile"],
        "id": roles.issuer.did,
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
                    "personal_administrative_number": { "sd": true },
                    "birth_date": { "sd": true },
                    "family_name": { "sd": true },
                    "given_name": { "sd": true },
                  }
                }
              }
            }
          }
        }
      }
    },
    "authenticationMethod": "PRE_AUTHORIZED",
    "standardVersion": config.oid4vci_version
  }
  // console.log(JSON.stringify(requestBody, null, 1))
  const credParams = {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(requestBody)
  }
  // console.log(JSON.stringify(pensionCredential, null, 1))
  const resp = await fetch(issueUrl, credParams)
  if (resp.status == 401) {
    const json = await auth()
    apiHeaders.Authorization = `Bearer ${json.access_token}`
    return getOffer(path) // possible recursion!
  }
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
  if (path == '/.well-known/openid-federation') {
    res.setHeader("Content-Type", "application/entity-statement+jwt")
    res.writeHead(200)
    res.end(config.issuer_entity_configuration)
    return false
  }
  else if (path.includes('.json')) {
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
<html lang="en">
 <meta charset="UTF-8">
 <title>walt.id myöntää eläketodisteen</title>
 <script src="https://unpkg.com/@qrcode-js/browser"></script>
 <style>
  *[lang]:not([lang="en"]) {
   display: none;
  }
  html {
   margin: 0;
   padding: 0;
  }
  body {
   font-family: Lato,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;
   margin: 0;
   padding: 0;
  }
  header {
   background-color: #003580;
   color: #FFF;
   display: flex;
   margin: 0;
   padding: 0.5em 2em 0 2em;
   height: 4em;
   overflow: hidden;
  }
  #qrcode {
    margin: 1em auto;
  }
  #language, #identity {
    display: flex;
    margin: 1em 2em;
  }
  #language ul {
   display: flex;
   margin: 0;
   padding: 0;
  }
  .language-switcher {
    padding-top: -0.25em;
  }
  .language-switcher li {
     background-color: #0d0342;
     border: 1px outset #4ffaff;
     border-color: #0d0342;
     border-width: 1px;
     border-style: outset;
     border-radius: 2em;
     box-sizing: border-box;
     color: #FFF;
     list-style-type: none;
     margin: 0em 0.5em 0 0;
     min-height: 2em;
     min-width: 2em;
     padding: 0.25em 0 0 0;
     text-align: center;
     width: 2em;
  }
  .language-switcher li.selected {
     background-color: #FFF;
     border-color: #4ffaff;
     border-style: inset;
     color: #0d0342;
  }
  #identity {
    padding-top: 0.5em;
  }
  #identity span {
    padding-left: 1em;
  }
  #identity form {
    display: none;
  }
  #identity:hover form {
    display: block;
  }
  #identity form input[type="submit"] {
    display: none;
  }
  #user, #identity form select {
    border-radius: 0.25em;
    margin: 0 0 0 1em;
  }
  .nav {
    background-color: #f0f5ff;
    display: flex;
    margin: 0;
    padding: 1em 2em;
  }
  .nav li {
    display: block;
    list-style-type: none;
    margin: 0 2em;
  }
  .nav li {
    color: #2a69c5;
    font-size: smaller;
  }
  .nav li:hover {
    cursor: pointer;
    text-decoration: underline;
  }
  #content {
    margin: 0 2em;
  }
 </style>
 <body>
  <header>
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 272.6 132" xml:space="preserve" height="48" width="83"><circle cx="242.9" cy="29.8" r="29.1" fill="#fff"></circle><path d="M226.8 7.8h5.8v2.6h7.2V7.8h6v2.7h7.2V7.8h5.7l3.8 41.3h-12.6s-.9-10-.9-9.6c.1.3-.9-5.6-6.5-5.2-5.9 0-6.2 5.8-6.2 5.8l-.8 9H223l3.8-41.3z" fill="#003580"></path><circle cx="242.7" cy="22.4" r="6.2" fill="#fff"></circle><path d="m43.8 130.1-26-44.6v44.6H.2V44.6h17.6v39l24.4-39h21.2L36 84.2l30.4 45.9H43.8zm40.4-28.3v.5c0 9.7 4.8 15.3 13.3 15.3 5.7 0 10.9-2.1 16-6.3l6.4 9.8c-7.3 5.9-14.9 8.7-23.7 8.7-18.1 0-29.8-12.8-29.8-32.6 0-11.3 2.3-18.8 7.9-25 5.2-5.8 11.4-8.5 19.8-8.5 7.3 0 14.1 2.5 18.2 6.6 5.8 5.9 8.4 14.4 8.4 27.6v3.8H84.2zM103.6 89c0-4.7-.5-7.1-2-9.5-1.6-2.5-3.9-3.7-7.3-3.7-6.3 0-9.8 4.9-9.8 13.7v.2h19.1V89zm44.9 40.6c-7 0-12.7-3.3-14.6-8.6-1.2-3.2-1.5-5.2-1.5-14.1v-47c0-8.2-.2-13.3-.9-18.9l16.9-3.8c.6 3.4.9 7.5.9 16.4v49.1c0 10.8.1 12.3 1.1 14 .6 1.1 2 1.7 3.3 1.7.6 0 1 0 1.8-.2l2.8 9.8c-2.8.9-6.3 1.6-9.8 1.6zm59.6 2.3c-3.8-1.6-6.9-5-8.5-8.2-1.2 1.2-2.6 2.5-3.8 3.3-3.1 2.2-7.5 3.4-12.7 3.4-14 0-21.6-7.1-21.6-19.7 0-14.8 10.2-21.6 30.3-21.6 1.2 0 2.3 0 3.7.1v-2.6c0-7-1.4-9.3-7.4-9.3-5.3 0-11.4 2.6-18.2 7.1l-7-11.8c3.3-2.1 5.8-3.3 10.2-5.2 6.1-2.6 11.4-3.7 17.2-3.7 10.6 0 17.8 3.9 20.3 10.9.9 2.6 1.2 4.6 1.1 11.3l-.4 21.2c-.1 6.9.4 9.8 5.9 14l-9.1 10.8zm-13.6-31.4c-11.4 0-15.4 2.1-15.4 9.6 0 4.9 3.1 8.2 7.3 8.2 3.1 0 6.2-1.6 8.6-4.3l.2-13.5h-.7z" fill="#fff"></path></svg>
   <div id="language">
   </div>
   <div id="identity">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em"><path fill="none" d="M0 0h24v24H0z"></path><path fill="none" stroke="currentColor" stroke-linejoin="round" stroke-width="2" d="M4 10h16v12H4z"></path><path fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="2" d="M17 10V7A5 5 0 0 0 7 7v3"></path></svg>
    <div id="user"><span lang="fi">Kirjaudu</span><span lang="en">Log in</span></div>
    <form id="idSelector">
     <select name="identity">
     <option value="" lang="fi">Valitse henkilöllisyytesi</option>
     <option value="" lang="en" selected="selected">Choose your identity</option>
     <option value="pensioncredential.json">Totti Aalto (KAEL)</option>
     <option value="pensioncredential-provisional.json">Edwin Kelimtes (väliaikainen TKEL)</option>
     <option value="pensioncredential-disability.json">Joni Kai Hiltunen (TKEL)</option>
     <option value="pensioncredential-rehabilitation.json">Jonne Aapeli Setälä (KUKI)</option>
     <option value="pensioncredential-rehabilitation-expired.json">Annina von Forsellestes (päättynyt KUKI)</option>
     </select>
    </form>
   </div>
  </header>
  <ol class="nav"><li><span lang="fi">Henkilöasiakkaat</span><span lang="en">Our services</span></li><li><span lang="fi">Työnantajat</span><li><span lang="fi">Kumppanit</span></li><li><span lang="fi">Tietoa Kelasta</span><span lang="en">About Kela</span></li></ol>
  <div id="content">
   <h1><span lang="fi">Lataa eläkeläistodiste</span><span lang="en">Get your pension credential</span></h1>
   <p id="instructions"><span lang="fi">Tunnistaudu palveluun valitsemalla henkilöllisyytesi yläpalkista!</span><span lang="en">Please log in using the top bar!</span></p>
   <canvas id="qrcode"></canvas>
   <p id="offer"></p>
  </div>
  <script>
   const params = new URLSearchParams(document.location.search)
   let currentLanguage = params.get('lang') || 'en'
   const lcontainer = document.querySelector('#language')
   const languages = ['fi', 'en']
   const defaultLanguage = currentLanguage
   const translatedElementsSelector = '[lang]'
   const switcher = document.createElement('ul')
   const css = document.styleSheets[0];
   switcher.className = 'language-switcher'
   languages.forEach((lang) => {
    const li = document.createElement('li')
    li.textContent = lang
    li.onclick = (e) => {
     currentLanguage = lang
     const currentParams = new URLSearchParams(document.location.search)
     let newParams = \`lang=\${encodeURIComponent(lang)}\`
     const currentUrl = currentParams.get('url')
     if (currentUrl) {
      newParams += \`&url=\${encodeURIComponent(currentUrl)}\`
     }
     history.pushState({lang, currentUrl}, '', \`\${document.location.href.split('?')[0]}?\${newParams}\`)
     const lis = switcher.querySelectorAll('li')
     for (l of lis) {
      l.classList.remove('selected')
     }
     li.classList.add('selected')
     const html = document.querySelector(':root')
     const oldLang = html.lang
     html.lang = lang
     for (let i = 0; i < css.cssRules.length; i++) {
      const rule = css.cssRules[i]
      if (rule.selectorText == \`[lang]:not([lang="\${oldLang}"])\`) {
       css.deleteRule(i)
       css.insertRule(\`[lang]:not([lang="\${lang}"]) { display: none; }\`, i)
      }
     }
     const opts = document.querySelectorAll('option[lang]')
     for (const opt of opts) {
      if (opt.lang == lang) {
       opt.selected = true
      }
      else {
       opt.selected = false
      }
     }
    }
    if (lang == defaultLanguage) {
     li.className = 'selected'
    }
    switcher.appendChild(li)
   })
   lcontainer.appendChild(switcher)

   const a = document.createElement('a')
   a.className = 'credential-offer'
   const o = document.querySelector('#offer')

   const f = document.querySelector('#idSelector')
   const idS = f.identity
   const user = document.querySelector('#user')
   idS.onchange = async function(e) {
    const file = this.value
    if (!file) return false
    user.textContent = this[this.selectedIndex].textContent
    const resp = await fetch(file)
    let qrUrl = await resp.text()
    console.log(qrUrl)
    const canvas = document.getElementById("qrcode")
    const qr = QRCode.QRCodeBrowser(canvas)
    qr.setOptions({
      text: qrUrl,
      size: 256,
    })
    qr.draw()
    document.querySelector('#instructions').innerHTML = '<span lang="fi">Lue QR-koodi lompakkosovelluksellasi</span><span lang="en">Scan the QR code using your digital wallet</span>'
    a.href = qrUrl
    o.textContent = ''
    o.appendChild(a)
    a.appendChild(canvas)
   }
   f.onsubmit = async function(e) {
    e.preventDefault()
   }
  </script>
 </body>
</html>`)
}

const server = createServer(sendOffer)
server.listen(config.issuer_port, config.server_host, () => {
  console.log(`Server is running on http://${config.server_host}:${config.issuer_port}`)
})
