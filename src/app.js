const HttpClient = require('./httpClient')
const Jira = require('./jira')

class App {

  constructor(event, issuetypes, transitions) {
    this.event = event
    this.issuetypes = issuetypes
    this.transitions = transitions
    this.httpClient = new HttpClient()
    this.jira = new Jira(this.httpClient)
  }

  async init() {
    this.validateInput()

    const commitMessages = this.getCommitMessages()
    const issueKeys = this.findIssueKeys(commitMessages)
    const transitionIssues = await this.getTransitionIdsAndKeys(issueKeys)
    await this.transitionIssues(transitionIssues.issueKeys, transitionIssues.transitionIds)
    if (transitionIssues.errors && transitionIssues.errors.length > 0) {
      throw new Error(transitionIssues.errors.join("\n"))
    }
  }

  validateInput() {
    if (!process.env.JIRA_BASE_URL) throw new Error('Please specify JIRA_BASE_URL env')
    if (!process.env.JIRA_API_TOKEN) throw new Error('Please specify JIRA_API_TOKEN env')
  }

  getCommitMessages() {
    const commitMessages = this.event.commits.map(commit => commit.message).join(' ')
    console.log(`Commit messages: ${commitMessages}`)
    return commitMessages
  }

  findIssueKeys(commitMessages) {
    const issueIdRegEx = /([a-zA-Z0-9]+-[0-9]+)/g
    // Get issue keys and remove duplicate keys
    const issueKeys = commitMessages.match(issueIdRegEx).filter((elem, index, self) => index === self.indexOf(elem))
    if (!issueKeys) {
      throw new Error(`Commit messages doesn't contain any issue keys`)
    }
    console.log(`Found issue keys: ${issueKeys.join(' ')}`)
    return issueKeys
  }

  async getTransitionIdsAndKeys(issues) {
    const transitionIds = [];
    const issueKeys = [];
    const errors = [];
    for (const issue of issues) {
      try {
        const issueData = await this.jira.getIssue(issue)
        const issuetypeName = issueData.fields.issuetype.name
        const issueStatus = issueData.fields.status.name
        const issuetypeIndex = this.issuetypes.indexOf(issuetypeName)
        if (issuetypeIndex == -1) {
          errors.push(`Issue "${issue}" is of type "${issuetypeName}" that is not yet allowed for transition. Currently, allowed issue types for transition are ${this.issuetypes}`)
          continue
        }
        
        if (this.transitions[issuetypeIndex] !== issueStatus) { // current status !== transition status
          const { transitions: availableTransitions } = await this.jira.getIssueTransitions(issue)
          const designatedTransition = availableTransitions.find(eachTransition => eachTransition.to.name.toLowerCase() === this.transitions[issuetypeIndex].toLowerCase())
          if (!designatedTransition) {
            errors.push(`For ${issue}, cannot find transition "${this.transitions[issuetypeIndex]}" among ${availableTransitions.map(t => t.to.name)}`)
            continue
          }
          issueKeys.push(issue)
          transitionIds.push({
            id: designatedTransition.id,
            name: designatedTransition.name
          })
        } else { // current status === transition status
          console.log(`Issue ${issue} is already in ${issueStatus} status`)
        }
      } catch(ex) {
        errors.push(`Issue "${issue}" encountered some exception: ${ex}`)
      }
    }
    return { issueKeys, transitionIds, errors }
  }

  async transitionIssues(issues, transitionIds) {
    for (let i=0; i<issues.length; i++) {
      console.log(`Transitioning issue "${issues[i]}" to "${transitionIds[i].name}"`)
      await this.jira.transitionIssue(issues[i], transitionIds[i].id)
    }
  }

}

module.exports = App