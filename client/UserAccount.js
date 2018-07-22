const React = require('react')
const h = require('react-hyperscript')
const withClickOutside = require('react-click-outside')
const TwitterPicker = require('react-color').TwitterPicker
const randomColor = require('randomcolor')
const DocumentTitle = require('react-document-title')
const BodyStyle = require('body-style')
const QRious = require('qrious')

const log = require('./log')
const graphql = require('./graphql')
const mergeColours = require('./helpers').mergeColours
const coloursfragment = require('./helpers').coloursfragment
const title = require('./helpers').title
const onLoggedStateChange = require('./auth').onLoggedStateChange

const UserAccount = React.createClass({
  getInitialState () {
    return {
      me: null,
      newDomain: '',
      activeCharge: null
    }
  },

  query () {
    graphql.query(`
query {
  me {
    colours { ...${coloursfragment} }
    domains
    id
    payments {
      id
      created_at
      amount
      paid_at
      has_paid
    }
  }
}
    `)
    .then(r => this.setState(r))
    .then(() => window.tc && window.tc())
    .catch(log.error)
  },

  componentDidMount () {
    onLoggedStateChange(isLogged => {
      if (isLogged) {
        this.query()
      }
    })
  },

  render () {
    if (!this.state.me) {
      return h('div')
    }

    let backgroundColor = mergeColours(this.state.me.colours).background

    return (
      h(DocumentTitle, {title: title('User account')}, [
        h(BodyStyle, {style: {backgroundColor}}, [
          h('.tile.is-ancestor.is-vertical', [
            h('.tile.is-12', [
              h('.tile', [
                h('.tile.is-parent', [
                  h('.tile.is-child', [
                    h('.card.account-domains', [
                      h('.card-header', [
                        h('.card-header-title', 'Registered domains')
                      ]),
                      h('.card-content', [
                        h('ul', this.state.me.domains.map(hostname =>
                          h('li', {key: hostname}, [
                            hostname + ' ',
                            h('a.delete', {onClick: e => { this.removeDomain(e, hostname) }})
                          ])
                        ).concat(
                          h('form', {key: '~', onSubmit: this.addDomain}, [
                            h('p.control.has-icon', [
                              h('input.input', {
                                type: 'text',
                                onChange: e => { this.setState({newDomain: e.target.value}) },
                                value: this.state.newDomain,
                                placeholder: 'Add a domain or subdomain'
                              }),
                              h('span.icon.is-small', [
                                h('i.fa.fa-plus')
                              ])
                            ]),
                            h('p.control', [
                              h('button.button', 'Save')
                            ])
                          ])
                        ))
                      ])
                    ])
                  ])
                ])
              ]),
              h('.tile', [
                h('.tile.is-parent', [
                  h('.tile.is-child', [
                    h('.card.account-colours', [
                      h('.card-header', [
                        h('.card-header-title', 'Interface colours')
                      ]),
                      h('.card-content', [
                        h(Colours, {
                          ...this.state,
                          onColour: this.changeColour
                        })
                      ])
                    ])
                  ])
                ]),
                h('.tile.is-parent', [
                  h('.tile.is-child', [
                    h('.card.account-info', [
                      h('.card-header', [
                        h('.card-header-title', 'Account information')
                      ]),
                      h('.card-content', [
                        h('p', `user: ${this.state.me.id}`)
                      ])
                    ])
                  ])
                ])
              ])
            ]),
            h('.tile.is-12', [
              h('.tile.is-4', [
                h('.tile.is-parent', [
                  h('.tile.is-child', [
                    h('.card.account-payments', [
                      h('.card-header', [
                        h('.card-header-title', 'Your payments')
                      ]),
                      h('.card-content', [
                        h('h2.title.is-2', 'Payments'),
                        h('table.table', [
                          h('tbody', this.state.me.payments.map(p =>
                            h('tr', [
                              h('td', p.id),
                              h('td', p.created_at),
                              h('td', `${p.amount} satoshis`),
                              h('td', p.has_paid ? `paid at ${p.paid_at}` : 'not paid')
                            ])
                          ))
                        ]),
                        h('hr'),
                        this.state.activeCharge
                          ? (
                            h('.charge', {
                              title: 'Use this code in your LN-enabled wallet.'
                            }, [
                              h('h3.title.is-3',
                                `${this.state.activeCharge.amount * 0.00000001} BTC`
                              ),
                              h('canvas', {
                                ref: el => {
                                  if (!el) return
                                  new QRious({
                                    element: el,
                                    value: this.state.activeCharge.payment_request,
                                    size: 250
                                  })
                                }
                              }),
                              this.state.activeCharge.payment_request
                            ])
                          )
                          : (
                            h('div', [
                              h('h4.title.is-4', 'Pay now'),
                              h('button.button', {
                                onClick: this.createCharge.bind(this, 100)
                              }, 'Pay 100 satoshi (1 bit)')
                            ])
                          )
                      ])
                    ])
                  ])
                ])
              ]),
              h('.tile.is-6'),
              h('.tile.is-2')
            ])
          ])
        ])
      ])
    )
  },

  createCharge (amount, e) {
    e.preventDefault()
    window.tc && window.tc(4)

    graphql.mutate(`
($amount: Int!) {
  createCharge(amount: $amount) {
    payment_request
    payment_hash
    amount
    id
    created
    description
    paid
  }
}
    `, {amount})
    .then(r => {
      this.setState(st => {
        st.activeCharge = r.createCharge
        return st
      })
    })
    .catch(log.error)
  },

  changeColour (field, colour) {
    window.tc && window.tc(1)
    graphql.mutate(`
($colours: ColoursInput!) {
  setColours(colours: $colours) {
    ok, error
  }
}
    `, {colours: {...this.state.me.colours, ...{[field]: colour}}})
    .then(r => {
      if (!r.setColours.ok) {
        log.error('failed to setColours:', r.setColours.error)
        return
      }
      this.setState(st => {
        st.me.colours[field] = colour
        return st
      })
    })
    .catch(log.error)
  },

  addDomain (e) {
    e.preventDefault()
    window.tc && window.tc(1)
    let hostname = this.state.newDomain

    graphql.mutate(`
($hostname: String!) {
  addDomain(hostname: $hostname) {
    ok, error
  }
}
    `, {hostname})
    .then(r => {
      if (!r.addDomain.ok) {
        log.error('error adding domain: ', r.addDomain.error)
        return
      }
      log.info(hostname, 'added.')
      this.query()
    })
    .catch(log.error)
  },

  removeDomain (e, host) {
    e.preventDefault()
    window.tc && window.tc(1)

    graphql.mutate(`
($host: String!) {
  removeDomain(hostname: $host) {
    ok, error
  }
}
    `, {host})
    .then(r => {
      if (!r.removeDomain.ok) {
        log.error('error removing domain:', r.removeDomain.error)
        return
      }
      log.info(host, 'removed.')
      this.query()
    })
    .catch(log.error)
  }
})

const Colours = withClickOutside(React.createClass({
  getInitialState () {
    return {
      display: null
    }
  },

  render () {
    let colours = mergeColours(this.props.me.colours)

    return (
      h('.colours', [
        Object.keys(colours).map(field =>
          h('div', {key: field}, [
            h('a', {
              onClick: (e) => {
                e.preventDefault()
                this.setState({display: field})
              }
            }, [
              h('i.fa.fa-square', {
                style: {
                  color: colours[field],
                  fontSize: '50px'
                }
              })
            ]),
            field === this.state.display && h(TwitterPicker, {
              colors: randomColor({count: 10}),
              onChange: ({hex}) => this.props.onColour(field, hex)
            })
          ])
        )
      ])
    )
  },

  handleClickOutside () {
    this.setState({display: null})
  }
}))

module.exports = UserAccount
