import { createHash } from 'node:crypto'

const ns_prefix = "https://pensiondemo.findy.fi/credentials"
const issuer = {
  "name": "Kela",
  "did": "did:key:z6MkqbWvWjTXEVANffRXBNmJv9hFtNeZf9bUJxFkF7tgKN1b"
}

const hash = createHash('sha256')
const salt = ns_prefix

const credential = {
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://pensiondemo.findy.fi/pensioncredential-schema/pensioncredential-v09.json"
  ],
  "id": `${ns_prefix}/${new Date().getTime()}`,
  "type": [
    "VerifiableCredential",
    "PensionCredential"
  ],
  "issuer": {
    "type": ["Profile"],
    "id": issuer.did,
    "name": issuer.name,
    "url": issuer.url,
    "url": issuer.image,
  },
  "issuanceDate": new Date().toISOString(),
  "expirationDate": new Date().toISOString(),
  "credentialSubject": {
    "pension": {
      "type": "Varhennettu kansaneläke",
      "startDate": "2024-02-01",
      "endDate": "2024-08-01",
      "status": "Väliaikainen"
    },
    "person": {
      "firstName": "Matti",
      "lastName": "Meikäläinen",
      "dateOfBirth": "1960-07-31"
    },
    "identityObject": {
      "hashed": true,
      "identityHash": `sha256$${hash.update('Matti Meikäläinen'+salt).digest('hex')}`,
      "identityType": "name",
      "salt": salt
    }
  }
}

console.log(JSON.stringify(credential, null, 2))
export const pensionCredential = credential