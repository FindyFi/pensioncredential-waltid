import config from './config.json' with {'type': 'json'}

const params = {
    method: 'POST',
    headers: {
        'Content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
        username: config.keycloak_username,
        password: config.keycloak_password,
        grant_type: "password",
        client_id: "waltid-test-token"
    })
}

export default async function auth() {
    // console.log(config)
    // console.log(config.token_url, params)
    const resp = await fetch(config.token_url, params)
    if (resp.status != 200) {
        console.error(resp.status, config.token_url)
        console.log(JSON.stringify(params, null, 1))
    }
    const json = await resp.json()
    // console.log(JSON.stringify(json, null, 1))
    return json
}

