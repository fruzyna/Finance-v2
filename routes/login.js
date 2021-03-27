var express = require('express')
var router = express.Router()

// connect to db
var mysql = require('mysql')
var config = require('../sql-config.json')
var connection = mysql.createPool(config)

var utils = require('./utils')

router.get('/', function(req, res, next)
{
  res.render('login', { error_text: req.query.error_text })
})

router.post('/', function(req, res, next)
{
  let user = utils.sanitize(req.body.user)
  let pass = utils.sanitize(req.body.pass)

  connection.query(`SELECT id FROM users
                    WHERE username = ${user} and password = password(${pass})`, function (error, results, fields)
  {
    if (error) 
    {
      console.log(error)
      res.redirect('/login?error_text=Login failure')
    }
    else if (results.length > 0)
    {
      let uid = utils.sanitize(results[0].id)
      let key = utils.sanitize(utils.generate_key())
      let agent = utils.sanitize(req.headers['user-agent'])

      connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                        VALUES (${key}, ${uid}, now(), ${agent})`, function (error, results, fields)
      {
        if (error)
        {
          console.log(error)
          res.redirect('/login?error_text=Login failure')
        }
        else
        {
          res.cookie('session', key, { maxAge: 2678400 }) // 31 days 
          res.redirect('/')
        }
      })
    }
    else
    {
      res.redirect('/login?error_text=Invalid username or password')
    }
  })
})

router.post('/create', function(req, res, next)
{
  let user = utils.sanitize(req.body.user)
  let pass = utils.sanitize(req.body.pass1)
  let user_valid = utils.validate_username(req.body.user)
  let pass_valid = utils.validate_password(req.body.pass1, req.body.pass2)

  if (user_valid != 'valid')
  {
    res.redirect(`/login?error_text=${user_valid}`)
  }
  else if (pass_valid != 'valid')
  {
    res.redirect(`/login?error_text=${pass_valid}`)
  }
  else
  {
    connection.query(`INSERT INTO users (username, password)
                      VALUES (${user}, password(${pass}))`, function (error, results, fields)
    {
      if (error) 
      {
        console.log(error)
        res.redirect('/login?error_text=Account already exists')
      }
      else
      {
        connection.query(`SELECT id FROM users
                          WHERE username = ${user} and password = password(${pass})`, function (error, results, fields)
        {
          if (error) 
          {
            console.log(error)
            res.redirect('/login?error_text=Failed to create account')
          }
          else
          {
            let uid = utils.sanitize(results[0].id)
            let key = utils.sanitize(utils.generate_key())
            let agent = utils.sanitize(req.headers['user-agent'])
            
            connection.query(`INSERT INTO sessions (session_key, user_id, last_accessed, description)
                              VALUES (${key}, ${uid}, now(), ${agent})`, function (error, results, fields)
            {
              if (error)
              {
                console.log(error)
                res.redirect('/login?error_text=Failed to login')
              }
              else
              {
                res.cookie('session', key, { maxAge: 2678400 }) // 31 days 
                res.redirect('/')
              }
            })
          }
        })
      }
    })
  }
})

module.exports = router