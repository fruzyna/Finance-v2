var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

/**
 * Homepage
 */
router.get('/', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`(SELECT date_format(date, "%Y-%m-%d") as date, amount as raw, format(amount, 2) as amount, "" as name
                        FROM transactions
                        WHERE user_id = ${user_id} and date >= SUBDATE(now(), 31))
                      UNION
                      (SELECT now() as date, sum(t.amount) as raw, format(sum(t.amount), 2) as amount, u.username as name
                        FROM transactions as t
                        INNER JOIN users as u ON u.id = ${user_id}
                        WHERE t.user_id = ${user_id})
                      ORDER BY date`, function (error, results, fields)
    {
      if (error)
      {
        res.send(error)
      }
      else if (results.length > 0)
      {
        res.render('index', { name: results[results.length-1].name, total: results[results.length-1].amount, totals: results })
      }
      else
      {
        res.redirect('/add')
      }
    })
  })
})

/**
 * Add Entry
 */
router.get('/add', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT DISTINCT location FROM transactions
                      WHERE user_id = ${user_id}`, function (error, locations, fields)
    {
      if (error || locations.length <= 0)
      {
        locations = {}
      }
      connection.query(`SELECT DISTINCT name FROM accounts
                        WHERE user_id = ${user_id}`, function (error, accounts, fields)
      {
        if (error || accounts.length <= 0)
        {
          accounts = {}
        }
        connection.query(`SELECT DISTINCT category FROM transactions
                          WHERE user_id = ${user_id}`, function (error, categories, fields)
        {
          if (error || categories.length <= 0)
          {
            categories = {}
          }
          res.render('add', { title: 'Finance | Add Entry', q: req.query, locations: locations, accounts: accounts, categories: categories })
        })
      })
    })
  })
})

router.post('/add', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let date        = utils.process_date(req.body.date)
    let account     = utils.sanitize(req.body.account)
    let transfer    = utils.sanitize(req.body.transfer)
    let title       = utils.sanitize(req.body.title)
    let location    = utils.sanitize(req.body.location)
    let amount      = utils.sanitize(req.body.amount)
    let category    = utils.sanitize(req.body.category)
    let note        = utils.sanitize(req.body.note)
    let keep        = req.body.keep
    let qstr = `date=${req.body.date}&account=${req.body.account}&transfer=${req.body.transfer}&title=${req.body.title}&location=${req.body.location}&amount=${req.body.amount}&category=${req.body.category}&note=${req.body.note}`
    
    connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note)
                      SELECT ${user_id}, id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}
                      FROM accounts
                      WHERE name = ${account} and user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        res.send(error)
      }
      else
      {
        let id = results.insertId
        if (req.body.transfer !== undefined && req.body.transfer != "")
        {
          let amount = utils.sanitize(-req.body.amount)
          connection.query(`INSERT INTO transactions (user_id, account_id, date, title, location, amount, category, note, linked_transaction)
                            SELECT ${user_id}, a.id, ${date}, ${title}, ${location}, ${amount}, ${category}, ${note}, max(t.id)
                            FROM accounts as a, transactions as t
                            WHERE a.name = ${transfer} and t.user_id = ${user_id} and a.user_id = ${user_id}`, function (error, results, fields)
          {
            if (error)
            {
              res.send(error)
            }
            else
            {
              connection.query(`UPDATE transactions SET linked_transaction = 
                                  (SELECT max(id) FROM transactions
                                  WHERE user_id = ${user_id})
                                WHERE id = ${id}`, function (error, results, fields)
              {
                if (error)
                {
                  res.send(error)
                }
                else if (!keep)
                {
                  res.redirect('/history')
                }
                else
                {
                  res.redirect(`/add?${qstr}`)
                }
              })
            }
          })
        }
        else if (!keep)
        {
          res.redirect('/history')
        }
        else
        {
          res.redirect(`/add?${qstr}`)
        }
      }
    })
  })
})

module.exports = router