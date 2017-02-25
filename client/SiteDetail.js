const React = require('react')
const h = require('react-hyperscript')
const R = require('recharts')
const months = require('months')

const snippet = require('./snippet')
const graphql = require('./graphql')

const names = {
  s: 'unique sessions',
  v: 'all pageviews'
}

function formatlabel (d) {
  if (d) {
    let month = months.abbr[parseInt(d.slice(4, 6)) - 1]
    return d.slice(6) + '/' + month + '/' + d.slice(0, 4)
  }
}

function crunch (days, key) {
  var crunched = {}
  for (let i = 0; i < days.length; i++) {
    let entries = days[i][key]
    for (let j = 0; j < entries.length; j++) {
      let entry = entries[j]
      crunched[entry.a] = crunched[entry.a] || 0
      crunched[entry.a] += entry.c
    }

    // recharts complains of these arrays here, so let's remove them after use
    delete days[i][key]
  }
  return Object.keys(crunched)
    .filter(k => k)
    .sort((a, b) => crunched[b] - crunched[a])
    .map(k => [k, crunched[k]])
}


module.exports = React.createClass({
  getInitialState () {
    return {
      site: {
        today: {},
        days: []
      },
      dataMax: 100,
      referrers: [],
      pages: [],
      nlastdays: 60
    }
  },

  query () {
    graphql.query(`
      query d($code: String!, $last: Int) {
        site(code: $code) {
          name
          code
          days(last: $last) {
            day
            s
            v
            p { a, c }
            r { a, c }
          }
          today {
            s
            v
          }
        }
      }
    `, {code: this.props.match.params.code, last: this.props.nlastdays})
    .then(r => {
      this.setState({
        site: r.site,
        dataMax: Math.max(...r.site.days.map(d => d.v)),
        referrers: crunch(r.site.days, 'r'),
        pages: crunch(r.site.days, 'p')
      })
    })
    .catch(console.log.bind(console))
  },

  componentDidMount () {
    this.query()
  },

  componentWillReceiveProps (nextProps) {
    if (nextProps.match.params.code !== this.props.match.params.code) this.query()
  },

  render () {
    return (
      h('.container', [
        h('.content', [
          h('h4.title.is-3', this.state.site.name),
          h('h6.subtitle.is-6', this.state.site.code)
        ]),
        this.state.dataMax === 0 && this.state.site.today.v === 0
        ? h(NoData, this.state)
        : h(Data, this.state)
      ])
    )
  }
})

const CustomTooltip = function (props) {
  return (
    h('div.custom-tooltip', [
      h('p.recharts-tooltip-label', formatlabel(props.label)),
      h('ul.recharts-tooltip-item-list', props.payload.map(item =>
        h('li.recharts-tooltip-item', {style: {color: item.color}}, [
          h('span.recharts-tooltip-item-name', names[item.name]),
          h('span.recharts-tooltip-item-separator', ' : '),
          h('span.recharts-tooltip-item-value', item.value)
        ])
      ))
    ])
  )
}

const Data = React.createClass({
  getInitialState () {
    return {
      pagesOpen: false,
      referrersOpen: false
    }
  },

  render () {
    let pagesMore = this.props.pages.length > 12
    var pages = this.props.pages
    if (!this.state.pagesOpen) {
      pages = this.props.pages.slice(0, 12)
    }
    let referrersMore = this.props.referrers.length > 12
    var referrers = this.props.referrers
    if (!this.state.referrersOpen) {
      referrers = this.props.referrers.slice(0, 12)
    }

    return (
      h('.container', [
        h('.columns', [
          h('.column.is-half', [
            h('.card.detail-today.has-text-left', [
              h('.card-content', [
                h('h4.subtitle.is-4', 'Pageviews today:'),
                h('h1.title.is-1', this.props.site.today.v || 0)
              ])
            ])
          ]),
          h('.column.is-half', [
            h('.card.detail-today.has-text-right', [
              h('.card-content', [
                h('h4.subtitle.is-4', 'Sessions today:'),
                h('h1.title.is-1', this.props.site.today.s || 0)
              ])
            ])
          ])
        ]),
        h('.card.detail-chart', [
          h('.card-header', [
            h('p.card-header-title', [
              'Number of sessions and pageviews',
              h('small', `in the last ${this.props.nlastdays} days`)
            ])
          ]),
          h('.card-image', [
            h('figure.image', [
              h(R.ResponsiveContainer, {height: 300, width: '100%'}, [
                h(R.ComposedChart, {data: this.props.site.days}, [
                  h(R.XAxis, {dataKey: 'day', hide: true}),
                  h(R.YAxis, {
                    scale: 'linear',
                    domain: [0, this.props.dataMax],
                    orientation: 'right'
                  }),
                  h(R.Tooltip, {
                    isAnimationActive: false,
                    content: CustomTooltip
                  }),
                  h(R.Bar, {
                    dataKey: 's',
                    fill: '#8884d8'
                  }),
                  h(R.Line, {
                    dataKey: 'v',
                    stroke: '#82ca9d'
                  })
                ])
              ])
            ])
          ])
        ]),
        h('.columns', [
          h('.column.is-half', [
            h('.card.detail-table', [
              h('.card-header', [
                h('p.card-header-title', [
                  'Most viewed pages',
                  h('small', `in the last ${this.props.nlastdays} days`)
                ])
              ]),
              h('.card-content', [
                h('table.table', [
                  h('tbody', pages.map(([addr, count]) =>
                    h('tr', [
                      h('td', addr),
                      h('td', count)
                    ])
                  ))
                ]),
                pagesMore
                ? this.state.pagesOpen
                  ? h('a', {onClick: () => { this.setState({pagesOpen: false}) }}, 'see less')
                  : h('a', {onClick: () => { this.setState({pagesOpen: true}) }}, 'see more')
                : ''
              ])
            ])
          ]),
          h('.column.is-half', [
            h('.card.detail-table', [
              h('.card-header', [
                h('p.card-header-title', [
                  'Top referring sites',
                  h('small', `in the last ${this.props.nlastdays} days`)
                ])
              ]),
              h('.card-content', [
                h('table.table', [
                  h('tbody', referrers.map(([addr, count]) =>
                    h('tr', [
                      h('td', [
                        addr + ' ',
                        addr === '<direct>'
                        ? ''
                        : (
                          h('a', {target: '_blank', href: addr}, [
                            h('img', {src: `data:image/svg+xml,<%3Fxml%20version%3D"1.0"%20encoding%3D"UTF-8"%20standalone%3D"no"%3F><svg%20xmlns%3D"http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg"%20width%3D"12"%20height%3D"12"><path%20fill%3D"%23fff"%20stroke%3D"%2306c"%20d%3D"M1.5%204.518h5.982V10.5H1.5z"%2F><path%20d%3D"M5.765%201H11v5.39L9.427%207.937l-1.31-1.31L5.393%209.35l-2.69-2.688%202.81-2.808L4.2%202.544z"%20fill%3D"%2306f"%2F><path%20d%3D"M9.995%202.004l.022%204.885L8.2%205.07%205.32%207.95%204.09%206.723l2.882-2.88-1.85-1.852z"%20fill%3D"%23fff"%2F><%2Fsvg>`})
                          ])
                        )
                      ]),
                      h('td', count)
                    ])
                  ))
                ]),
                referrersMore
                ? this.state.referrersOpen
                  ? h('a', {onClick: () => { this.setState({referrersOpen: false}) }}, 'see less')
                  : h('a', {onClick: () => { this.setState({referrersOpen: true}) }}, 'see more')
                : ''
              ])
            ])
          ])
        ])
      ])
    )
  }
})

const NoData = function (props) {
  return (
    h('.card.trackingcode', [
      h('.card-content', [
        h('.content', [
          h('p', 'This site has no data yet. Have you installed the tracking code?'),
          h('p', 'Just paste the following in any part of your site:'),
          h('pre', [
            h('code', `<script>;${snippet(props.site.code)};</script>`)
          ])
        ])
      ])
    ])
  )
}
