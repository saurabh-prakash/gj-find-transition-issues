const axios = require('axios')

class HttpClient {

  constructor() {
    axios.defaults.baseURL = `${process.env.JIRA_BASE_URL}/rest/api/2`
    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${process.env.JIRA_API_TOKEN}`
    }
  }

  async get(path) {
    return axios({
      method: 'get',
      url: path,
      headers: this.headers
    }).then(result => result.data)
  }

  async post(path, body) {
    return axios({
      method: 'post',
      url: path,
      headers: this.headers,
      data: body
    }).then(result => result.data)
  }

}

module.exports = HttpClient