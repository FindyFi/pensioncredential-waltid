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
        "vct": `${config.issuer_api}/${config.credentialType}`,
        "input_descriptor": {
          "id": uuidv4(),
          // "id": `${config.credentialType}_${config.credentialFormat}`,
          "format": {
            "vc+sd-jwt": {
              "alg": ["sha-256", "secp256k1", "ES256", "ES256K", "PS256"],
            },
          },
          "name": config.credentialType, // "Eläketodiste" (?)
          "purpose": "HSL:n eläkealennusoikeuden rekisteröintiin",
          "constraints": {
            "fields": [
              {
                "path": [
                  "$.Person.personal_administrative_number",
                  "$..Person.personal_administrative_number",
                ],
                "filter": {
                  "type": "string",
                  "pattern": ".*"
                },
                "optional": false
              },
              {
                "path": [
                  "$.Pension.typeCode",
                  "$..Pension.typeCode",
                ],
                "filter": {
                  "type": "string",
                  "pattern": ".*"
                },
                "optional": false
              },
            ],
            "limit_disclosure": "required"
          }
        }
      }
    ]
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
  const searchParams = new URLSearchParams(new URL(credentialRequest).search)
  const requestURL = searchParams.get('presentation_definition_uri')
  const requestResponse = await fetch(requestURL)
  const request = await requestResponse?.json()
  const dataURL = await QRCode.toDataURL(credentialRequest)
  res.setHeader("Content-Type", "text/html")
  res.writeHead(200)
  res.end(`<!DOCTYPE html>
<html lang="en">
 <meta charset="UTF-8">
 <meta http-equiv="origin-trial" content="Ao6trqrvq0CAiUXLvpfRFxFnxVBs6c5ugVIiCmixsxIwWZmaSerp7cx5O10/mYAXfpkfZK6j3Ks+KE9nCl9C9AQAAAByeyJvcmlnaW4iOiJodHRwczovL2ZpbmR5LmZpOjQ0MyIsImZlYXR1cmUiOiJXZWJJZGVudGl0eURpZ2l0YWxDcmVkZW50aWFscyIsImV4cGlyeSI6MTc1MzE0MjQwMCwiaXNTdWJkb21haW4iOnRydWV9">
 <title>walt.id vastaanottaa eläkeläistodisteen</title>
 <style>
   *[lang]:not([lang="en"]) {
   display: none;
  }
  html {
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Gotham Rounded A,Gotham Rounded B,Arial,Georgia,serif;
    margin: 0;
    padding: 0;
  }
  #language {
   display: flex;
   float: right;
   margin: 0 1em 0 auto;
   padding: 0;
  }
  #language ul {
   display: flex;
   margin: 0;
   padding: 0.5em;
  }
  .language-switcher {
    margin: 0.5em;
  }
  .language-switcher li {
     color: #007ac9;
     list-style-type: none;
     margin: 0em 0.5em 0 0;
     text-align: center;
     width: 2em;
  }
  .language-switcher li.selected {
    text-decoration: underline;
  }
  header {
    clear: both;
    margin: 0;
    padding: 0;
  }
  header li svg {
    margin-top: -1em;
  }
  .nav {
    background-color: #007ac9;
    color: #FFF;
    display: flex;
    margin: 0;
    padding: 1em 2em 0 2em;
  }
  .nav li {
    display: block;
    list-style-type: none;
    margin: 0 2em;
    padding: 0.5em 0;
  }
  .nav li:hover {
    cursor: pointer;
    text-decoration: underline;
  }
  #content {
    margin: 0 4em;
  }
  #content.full pre {
    display: block;
  }
  table {
    max-width: 30em;
    margin: 1em auto;
  }
  th, td {
    text-align: left;
  }
  button {
    background-color: #007ac9;
    border-color: #007ac9;
    border-radius: 0.5em;
    color: #FFF;
    font-size: x-large;
  }
  pre {
    background-color: black;
    color: green;
    display: none;
    text-align: left;
  }
/*
  #fallback {
    display: none;
  }
*/

 </style>
 <body style="text-align: center;">
  <div id="language"></div>
  <header>
   <ol class="nav">
    <li><svg width="106" height="40" viewBox="0 0 106 40" class="" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path fill="#FFFFFF" fill-rule="evenodd" d="M48.877.339c.27-.164.608-.164.878 0 .27.163.428.462.41.778v37.948c.018.316-.14.616-.41.779-.27.163-.608.163-.878 0s-.428-.463-.41-.779V1.118c-.018-.317.14-.616.41-.78zm3.404 0c.27-.164.608-.164.878 0 .27.163.428.462.41.778v37.948c.018.316-.14.616-.41.779-.27.163-.608.163-.878 0s-.428-.463-.41-.779V1.118c-.018-.317.14-.616.41-.78zM19.74.25c1.742 0 2.986 1.593 2.986 3.787-.038 1.123-.466 2.196-1.209 3.035l6.136 2.55c.065-1.119.517-2.18 1.279-3 1.538-1.56 3.553-1.784 4.773-.56 1.219 1.225.985 3.243-.56 4.795-.816.766-1.872 1.22-2.986 1.286l2.545 6.17c.835-.747 1.904-1.177 3.021-1.215 2.185 0 3.797 1.25 3.797 3s-1.585 3-3.77 3c-1.117-.039-2.185-.469-3.02-1.215l-2.546 6.17c1.115.063 2.172.52 2.986 1.287 1.555 1.545 1.784 3.573.56 4.795-1.224 1.223-3.23.988-4.773-.565-.762-.819-1.215-1.88-1.279-3l-6.143 2.555c.743.838 1.17 1.91 1.21 3.032 0 2.198-1.245 3.788-2.987 3.788-1.741 0-2.986-1.59-2.986-3.788.038-1.121.466-2.195 1.21-3.032l-6.144-2.555c-.063 1.12-.516 2.181-1.279 3-1.535 1.553-3.548 1.795-4.77.565-1.222-1.23-.988-3.247.558-4.795.814-.768 1.87-1.224 2.985-1.288l-2.545-6.17c-.834.748-1.902 1.178-3.018 1.215-2.185 0-3.77-1.25-3.77-3s1.585-3 3.77-3c1.116.038 2.184.468 3.018 1.215l2.538-6.165c-1.114-.066-2.17-.52-2.986-1.284-1.55-1.545-1.772-3.568-.555-4.795 1.217-1.228 3.225-.993 4.77.56.762.819 1.214 1.88 1.28 3l6.128-2.556c-.744-.838-1.172-1.912-1.21-3.035 0-2.194 1.245-3.787 2.986-3.787zm.003 33.627c-1.217.735-1.264 2.185-1.264 2.273.002 1.193.532 2.055 1.264 2.055.739 0 1.269-.862 1.269-2.055-.003-.087-.047-1.538-1.27-2.273zM78.328 21.34c.27.163.428.462.41.779V35.75c.018.316-.14.616-.41.779-.27.163-.608.163-.878 0s-.428-.463-.41-.779v-6.063h-8.71v6.063c0 .305-.162.588-.425.74-.264.153-.588.153-.851 0-.264-.152-.426-.435-.426-.74V22.117c0-.305.162-.587.426-.74.263-.153.587-.153.85 0 .264.153.426.435.426.74v5.97h8.71v-5.97c-.018-.316.14-.615.41-.778.27-.164.608-.164.878 0zm9.301.021c1.854 0 3.337.56 4.285 1.5.77.804 1.19 1.884 1.167 3v.04c0 2.5-1.685 3.94-4.031 4.393l3.747 4.845c.17.166.272.391.284.63-.028.463-.404.829-.866.842-.322-.013-.618-.183-.794-.455l-4.242-5.54h-4.32v5.135c.017.316-.14.616-.41.779-.27.163-.608.163-.878 0s-.428-.463-.411-.779l-.013-13.525c-.001-.47.373-.855.841-.865h5.641zm17.376 0c.437.007.79.36.798.8-.01.435-.365.782-.798.777h-4.372V35.75c0 .478-.386.865-.861.865-.476 0-.861-.387-.861-.865V22.937h-4.372c-.434.006-.79-.341-.799-.777.007-.44.361-.795.8-.8h10.465zm-73.07 9.188c-.055-.058-1.11-1.053-2.489-.703-.343 1.383.647 2.438.702 2.5.853.84 1.829 1.08 2.346.558.52-.523.286-1.513-.56-2.355zm-21.897-.705c-1.376-.35-2.429.645-2.489.702-.84.845-1.072 1.835-.554 2.358.517.522 1.502.282 2.346-.558.06-.06 1.05-1.117.697-2.502zm9.706-21.64l-8.365 3.482-3.469 8.408L11.38 28.5l8.365 3.48 8.373-3.48 3.469-8.41-3.469-8.405-8.373-3.482zm67.753 14.722H82.86v6.145l4.618.012c2.262 0 3.877-1.167 3.877-3.117v-.04c0-1.86-1.42-3-3.857-3zM35.73 18.82c-.085 0-1.53.045-2.26 1.273.73 1.224 2.175 1.272 2.26 1.272 1.187-.005 2.05-.537 2.05-1.272s-.863-1.273-2.05-1.273zm-31.967 0c-1.187 0-2.05.538-2.05 1.273 0 .735.863 1.272 2.05 1.272.087-.005 1.533-.047 2.262-1.272-.731-1.228-2.177-1.273-2.262-1.273zM86.808 3.582c1.69-.026 3.35.44 4.782 1.34.467.276.751.78.747 1.323 0 .411-.164.806-.456 1.094-.292.289-.687.448-1.097.441-.297-.001-.588-.088-.838-.25-1.098-.647-2.133-1.013-3.165-1.013-1.27 0-1.939.58-1.939 1.318v.043c0 1 .647 1.32 3.252 2 3.059.797 4.78 1.9 4.78 4.54v.045c0 3-2.284 4.695-5.533 4.695-2.037.002-4.023-.638-5.679-1.828-.392-.295-.623-.758-.622-1.25-.001-.412.162-.807.454-1.096.292-.289.687-.448 1.096-.441.34-.004.672.103.946.305 1.101.867 2.457 1.345 3.857 1.36 1.356 0 2.175-.54 2.175-1.428v-.03c0-.85-.52-1.28-3.036-1.928-3.038-.782-4.997-1.624-4.997-4.632v-.042c0-2.75 2.195-4.566 5.273-4.566zm-8.564.243c.523.312.834.887.81 1.497v12.073c.024.61-.287 1.185-.81 1.498-.522.312-1.173.312-1.696 0-.523-.313-.834-.887-.81-1.498v-4.543h-6.114v4.543c0 .596-.316 1.146-.83 1.444-.513.298-1.146.298-1.66 0-.513-.298-.83-.848-.83-1.444V5.323c0-.596.317-1.147.83-1.445.514-.297 1.147-.297 1.66 0 .514.298.83.849.83 1.444V9.78h6.114V5.323c-.024-.611.287-1.186.81-1.498.523-.313 1.174-.313 1.696 0zm18.253-.167c.916 0 1.658.745 1.658 1.664V15.9h6.138c.81.033 1.45.702 1.45 1.516 0 .814-.64 1.483-1.45 1.517h-7.796c-.44.004-.865-.17-1.177-.485-.312-.313-.485-.74-.48-1.183V5.322c0-.92.742-1.664 1.657-1.664zM32.5 7.282c-.517-.522-1.503-.285-2.346.558-.045.058-1.04 1.117-.697 2.505 1.374.348 2.429-.648 2.488-.705.839-.845 1.073-1.835.555-2.358zm-23.158.556c-.851-.843-1.829-1.08-2.344-.558-.528.522-.279 1.513.56 2.353.055.057 1.107 1.052 2.488.705.346-1.38-.644-2.44-.704-2.5zm10.403-5.865c-.731 0-1.261.867-1.264 2.062.003.085.048 1.535 1.264 2.27 1.222-.735 1.27-2.185 1.27-2.27-.003-1.195-.523-2.063-1.27-2.063z"></path></svg></li>
    <li><span lang="fi">Liput ja hinnat</span><span lang="en">Tickets and fares</span></li><li><span lang="fi">Matkustaminen</span><span lang="en">Travelling</span></li><li><span lang="fi">Asiakaspalvelu</span><span lang="en">Customer service</span></li><li><span lang="fi">HSL</span><span lang="en">HSL</span></li></ol>
  </header>
  <h1><span lang="fi">Hanki eläkeläisalennus</span><span lang="en">Get pensioner discount</span></h1>
  <div id="content">
   <div id="fallback">
    <a href="${credentialRequest}"><img src="${dataURL}" alt="Credential Request QR Code" /></a>
    <p><span lang="fi">Lue QR-koodi lompakkosovelluksellasi</span><span lang="en">Scan the QR code using your digital wallet</span></p>
   </div>
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
     console.log(e)
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
    }
    if (lang == defaultLanguage) {
     li.className = 'selected'
    }
    switcher.appendChild(li)
   })
   lcontainer.appendChild(switcher)
   const c = document.querySelector('#content')
/*
   const a = document.createElement('a')
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
   a.innerHTML = o
   c.appendChild(a)
*/
   if (typeof window.DigitalCredential !== 'undefined') {
    const b = document.createElement('button')
    b.innerHTML = '<span lang="en">Display your pension credential</span><span lang="fi">Näytä eläketodiste</span>'
    b.onclick = async function() {
     // c.innerHTML += '${JSON.stringify(request)}'
     try {
      // create an Abort Controller
      const controller = new AbortController()
      const dcResponse = await navigator.credentials.get({
       signal: controller.signal,
       mediation: "required",
       digital: {
        providers: [{
         protocol: "openid4vp",
         request: ${JSON.stringify(request)}
        }]
       }
      })
      // c.innerHTML += JSON.stringify(dcResponse, null, 1)
      const data = credentialResponse.token || credentialResponse.data
      const html = \`<pre style="display:block;">\${JSON.stringify(data, null, 2)}</pre>\`
      c.innerHTML = html
     } catch (error) {
      const pre = document.createElement('pre')
      pre.style.border = '2px solid red'
      pre.style.display = 'block'
      pre.innerHTML = error.message
      c.appendChild(pre)
     }
    }
    c.appendChild(b)
   }
   else {
    // document.querySelector('#fallback').style.display = 'block'
    // c.appendChild(document.createTextNode('DC API not supported'))
   }
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
    case '/.well-known/openid-federation':
      res.setHeader("Content-Type", "application/entity-statement+jwt")
      res.writeHead(200)
      res.end(config.verifier_entity_configuration)
      return false
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
