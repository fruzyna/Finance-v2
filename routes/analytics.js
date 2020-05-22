var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let limit = 10
    if (req.query.limit !== undefined)
    {
      limit = req.query.limit
    }

    let before    = utils.create_clause(req.query.before, `AND datediff(date, ${utils.process_date(req.query.before)}) < 0`)
    let after     = utils.create_clause(req.query.after, `AND datediff(date, ${utils.process_date(req.query.after)}) > 0`)
    let minimum   = `"${req.query.min || '1'}"`
    let groupby   = req.query.groupby || 'category'

    connection.query(`SELECT q.name, q.raw, q.formatted, q.num, q.mean
                      FROM (SELECT distinct ${groupby} as name, round(sum(amount), 2) as raw, format(sum(amount), 2) as formatted, count(id) as num, format(avg(amount), 2) as mean
                        FROM transactions
                        WHERE user_id = ${user_id} ${before} ${after}
                        GROUP BY ${groupby}) as q
                      WHERE q.num >= ${minimum}
                      ORDER BY q.raw DESC`, function (error, results, fields)
    {
        if (error)
        {
            console.log(error)
            res.render('history', { error_text: 'Error making search', title: 'Finance | Analytics', entries: results, query: req.query })
        }
        else if (results.length > 1)
        {
            res.render('analytics', { error_text: req.query.error_text, title: 'Finance | Analytics', entries: results, query: req.query })
        }
        else
        {
            res.render('history', { error_text: 'No results found', title: 'Finance | Analytics', entries: results, query: req.query })
        }
    })
  })
})

module.exports = router