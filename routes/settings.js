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
    connection.query(`SELECT right(session_key, 4) as session_key, last_accessed, description FROM sessions
                      WHERE user_id = ${user_id}`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.render('settings', { title: 'Finance | Settings', error_text: req.query.error_text, keys: [] })
      }
      else
      {
        res.render('settings', { title: 'Finance | Settings', error_text: req.query.error_text, keys: results })
      }
    })
  })
})

router.get('/rmsession', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`DELETE FROM sessions
                      WHERE right(session_key, 4) = "${req.query.key}"
                        and user_id = ${user_id}`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error deleting key ${req.query.key}`)
      }
      else
      {
        res.redirect('/settings')
      }
    })
  })
})

router.post('/chusername', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let user = req.body.user
    let user_valid = utils.validate_username(user)
    if (user_valid != 'valid')
    {
      res.redirect(`/settings?error_text=${user_valid}`)
    }
    else
    {
      connection.query(`UPDATE users SET username = ${utils.sanitize(user)}
                        WHERE id = ${user_id} and password = password(${utils.sanitize(req.body.pass)})`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.redirect('/settings?error_text=Username already exists')
        }
        else
        {
          connection.query(`SELECT username FROM users
                            WHERE id = ${user_id} and username = ${utils.sanitize(user)}`, function (error, results, fields)
          {
            if (error) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Error changing username')
            }
            else if (results.length == 0) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Incorrect password')
            }
            else
            {
              res.redirect('/settings?error_text=Successfully updated username')
            }
          })
        }
      })
    }
  })
})

router.post('/chpassword', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let pass = req.body.new1
    let pass_valid = utils.validate_password(pass, req.body.new2)
    if (pass_valid != 'valid')
    {
      res.redirect(`/settings?error_text=${pass_valid}`)
    }
    else
    {
      connection.query(`UPDATE users SET password = password(${utils.sanitize(pass)})
                        WHERE id = ${user_id} and password = password(${utils.sanitize(req.body.old)})`, function (error, results, fields)
      {
        if (error) 
        {
          console.log(error)
          res.redirect('/settings?error_text=Error changing password')
        }
        else
        {
          connection.query(`SELECT username FROM users
                            WHERE id = ${user_id} and password = password(${utils.sanitize(pass)})`, function (error, results, fields)
          {
            if (error) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Error changing password')
            }
            else if (results.length == 0) 
            {
              console.log(error)
              res.redirect('/settings?error_text=Incorrect password')
            }
            else
            {
              res.redirect('/settings?error_text=Successfully updated password')
            }
          })
        }
      })
    }
  })
})

router.get('/logout', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    let session = req.cookies.session
    res.redirect(`/settings/rmsession?key=${session.substr(session.length - 4)}`)
  })
})

router.get('/export', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT t.id, t.title, t.location, date_format(t.date, "%Y-%m-%d") as date, t.amount, a.name, t.category, t.note, t.linked_transaction
                      FROM transactions as t
                      INNER JOIN accounts as a ON t.account_id = a.id
                      WHERE t.user_id = ${user_id}
                      ORDER BY t.date DESC`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error exporting account`)
      }
      else if (results.length == 0)
      {
        res.redirect(`/settings?error_text=No transactions found`)
      }
      else
      {
        csvTxt = 'id,title,location,date,amount,account,category,note,linked_transaction\n'
        results.forEach(function (r, index)
        {
          csvTxt += `${r.id},${r.title},${r.location},${r.date},${r.amount},${r.name},${r.category},${r.note},${r.linked_transaction}\n`
        })
        res.set({'Content-Disposition': 'attachment; filename="finance-export.csv"'})
        res.send(csvTxt)
      }
    })
  })
})

router.get('/delete-account', function(req, res, next)
{
  utils.session_exists(connection, req, res, function (user_id)
  {
    connection.query(`SELECT username FROM users
                      WHERE id = ${user_id} and password = password(${utils.sanitize(req.query.password)})`, function (error, results, fields)
    {
      if (error)
      {
        console.log(error)
        res.redirect(`/settings?error_text=Error deleting account`)
      }
      else if (results.length > 0)
      {
        connection.query(`DELETE FROM transactions
                          WHERE user_id = ${user_id}`, function (error, results, fields)
        {
          if (error)
          {
            console.log(error)
            res.redirect(`/settings?error_text=Error deleting transactions`)
          }
          else
          {
            connection.query(`DELETE FROM accounts
                              WHERE user_id = ${user_id}`, function (error, results, fields)
            {
              if (error)
              {
                console.log(error)
                res.redirect(`/settings?error_text=Error deleting accounts`)
              }
              else
              {
                connection.query(`DELETE FROM sessions
                                  WHERE user_id = ${user_id}`, function (error, results, fields)
                {
                  if (error)
                  {
                    console.log(error)
                    res.redirect(`/settings?error_text=Error deleting sessions`)
                  }
                  else
                  {
                    connection.query(`DELETE FROM users
                                      WHERE id = ${user_id}`, function (error, results, fields)
                    {
                      if (error)
                      {
                        console.log(error)
                        res.redirect(`/settings?error_text=Error deleting account`)
                      }
                      else
                      {
                        res.redirect('/settings')
                      }
                    })
                  }
                })
              }
            })
          }
        })
      }
      else
      {
        res.redirect(`/settings?error_text=Invalid password`)
      }
    })
  })
})

module.exports = router