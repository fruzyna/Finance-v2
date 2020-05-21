var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

/**
 * Plot
 */
router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let account   = utils.create_clause(req.query.account, 'AND a.name = "$VALUE"')
    let before    = utils.create_clause(req.query.before, `AND datediff(t.date, ${utils.process_date(req.query.before)}) < 0`)
    let after     = utils.create_clause(req.query.after, `AND datediff(t.date, ${utils.process_date(req.query.after)}) > 0`)

    connection.query(`(SELECT date_format(t.date, "%Y-%m-%d") as date, sum(t.amount) as raw, format(sum(t.amount), 2) as amount
                        FROM transactions as t
                        INNER JOIN accounts as a ON a.id = t.account_id
                        WHERE t.user_id = ${user_id} ${account} ${before} ${after}
                        GROUP BY date)
                      UNION
                      (SELECT now() as date, sum(t.amount) as raw, format(sum(t.amount), 2) as amount
                        FROM transactions as t
                        INNER JOIN accounts as a ON a.id = t.account_id
                        WHERE t.user_id = ${user_id} ${account} ${before})
                      ORDER BY date`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.render('plot', { error_text: 'Error getting plot data', title: 'Finance | Plot', totals: [], query: req.query })
      }
      else if (results.length > 0)
      {
        res.render('plot', { error_text: '', title: 'Finance | Plot', totals: results, query: req.query })
      }
      else
      {
        res.redirect('/add')
      }
    })
  })
})

module.exports = router