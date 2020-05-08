var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  res.render('login', { error_text: '' })
})

router.post('/', function(req, res, next)
{
  user = req.body.user
  connection.query(`SELECT id FROM users
                    WHERE username = "${user}" and password = password("${req.body.pass}")`, function (error, results, fields)
  {
    if (error) 
    {
      console.log(error)
      res.render('login', { error_text: 'Login failure' })
    }
    else if (results.length > 0)
    {
      uid = results[0].id
      key = utils.generate_key()
      connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                        VALUES ("${key}", "${uid}", now(), "${req.headers['user-agent']}")`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.render('login', { error_text: 'Login failure' })
        }
        else
        {
          res.cookie('session', key, { maxAge: 2592000000})
          res.redirect('/')
        }
      })
    }
    else res.render('login', { error_text: 'Invalid username or password' })
  })
})

router.post('/create', function(req, res, next)
{
  user = req.body.user
  if (req.body.pass1 == req.body.pass2)
  {
    connection.query(`INSERT INTO users (username, password)
                      VALUES ("${user}", password("${req.body.pass1}"))`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.render('login', { error_text: 'Failed to create account' })
      }
      else
      {
        connection.query(`SELECT id FROM users
                          WHERE username = "${user}" and password = password("${req.body.pass1}")`, function (error, results, fields)
        {
          if (error) 
          {
            console.log(error)
            res.render('login', { error_text: 'Failed to create account' })
          }
          else
          {
            uid = results[0].id
            key = utils.generate_key()
            connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                              VALUES ("${key}", "${uid}", now(), "${req.headers['user-agent']}")`, function (error, results, fields)
            {
              if (error)
              {
                console.log(error)
                res.render('login', { error_text: 'Login failure' })
              }
              else
              {
                res.cookie('session', key, { maxAge: 2592000000})
                res.redirect('/')
              }
            })
          }
        })
      }
    })
  }
  else
  {
    res.render('login', { error_text: `Passwords don't match` })
  }
})

module.exports = router