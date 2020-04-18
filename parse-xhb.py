# Parse XHB
# 2020 Liam Fruzyna
# Parses a HomeBank .xhb file and produces SQL commands to populate the datebase.

import xml.etree.ElementTree as ET
from datetime import datetime as dt
from datetime import timedelta as td

tree = ET.parse('/home/liam/Documents/HomeBank/finance.xhb')
root = tree.getroot()

uid = 1

transactions = []

accounts = {}
for account in root.findall('account'):
    accounts[account.attrib['key']] = account.attrib['name']
    print('INSERT INTO accounts (user_id, name) VALUES ("{0}", "{1}");'.format(uid, account.attrib['name']))
    transaction = {}
    transaction['date'] = dt.strptime('2000-01-01', '%Y-%m-%d')
    transaction['amount'] = str(round(float(account.attrib['initial']), 2))
    transaction['account'] = account.attrib['name']
    transaction['title'] = 'Initial Balance'
    transaction['location'] = account.attrib['name']
    transaction['categories'] = ''
    transaction['note'] = ''
    transaction['transfer'] = False
    transactions.append(transaction)

locations = {}
for location in root.findall('pay'):
    locations[location.attrib['key']] = location.attrib['name']

categories = {}
for category in root.findall('cat'):
    categories[category.attrib['key']] = category.attrib['name']

for entry in root.findall('ope'):
    transaction = {}
    transaction['date'] = (dt.strptime('0001-01-01', '%Y-%m-%d') + td(days=int(entry.attrib['date'])-1)).strftime('%Y-%m-%d')
    transaction['amount'] = str(round(float(entry.attrib['amount']), 2))
    transaction['account'] = accounts[entry.attrib['account']]
    transaction['title'] = entry.attrib['info']
    if 'payee' in entry.attrib.keys():
        transaction['location'] = locations[entry.attrib['payee']]
    elif '@' in transaction['title']:
        parts = transaction['title'].split('@')
        transaction['title'] = parts[0]
        transaction['location'] = parts[1]
    else:
        transaction['location'] = ''
    if 'category' in entry.attrib.keys():
        transaction['categories'] = categories[entry.attrib['category']]
    else:
        transaction['categories'] = ''
    if 'wording' in entry.attrib.keys():
        transaction['note'] = entry.attrib['wording']
    else:
        transaction['note'] = ''
    if 'dst_account' in entry.attrib.keys():
        xfer = entry.attrib['kxfer']
        found = False
        for t in transactions:
            if t['transfer'] == xfer:
                found = True
                break
        if not found:
            transaction['transfer'] = xfer
            transactions.append(transaction)
            transfer = transaction.copy()
            transfer['account'] = accounts[entry.attrib['dst_account']]
            transfer['amount'] = str(-float(transfer['amount']))
            transactions.append(transfer)
    else:
        transaction['transfer'] = False
        transactions.append(transaction)

i = 0
while i < len(transactions):
    transaction = transactions[i]
    print("""INSERT INTO transactions (user_id, account_id, date, title, location, amount, categories, note)
    SELECT "{0}", id, "{2}", "{3}", "{4}", "{5}", "{6}", "{7}"
    FROM accounts WHERE name = "{1}";""".format(uid, transaction['account'], transaction['date'], transaction['title'], transaction['location'], transaction['amount'], transaction['categories'], transaction['note']))
    if transaction['transfer']:
        i += 1
        transaction = transactions[i]
        print("""INSERT INTO transactions (user_id, account_id, date, title, location, amount, categories, note, linked_transaction)
        SELECT "{0}", a.id, "{2}", "{3}", "{4}", "{5}", "{6}", "{7}", max(t.id)
        FROM accounts as a, transactions as t WHERE a.name = "{1}" and t.user_id = "{0}";""".format(uid, transaction['account'], transaction['date'], transaction['title'], transaction['location'], transaction['amount'], transaction['categories'], transaction['note']))
        
        print("""UPDATE transactions
        SET linked_transaction = (SELECT max(id) FROM transactions WHERE user_id = "{0}")
        WHERE id = (SELECT max(id) FROM transactions WHERE id < (SELECT max(id) FROM transactions WHERE user_id = "{0}") AND user_id = "{0}");""".format(uid))
    i += 1