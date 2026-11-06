import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { classify, toRecord } from './classify.ts'
import type { MailMessage } from './types.ts'

type Overrides = Omit<Partial<MailMessage>, 'headers'> & {
  headers?: Partial<MailMessage['headers']>
}

function message(overrides: Overrides = {}): MailMessage {
  const { headers, ...rest } = overrides
  return {
    uid: 1,
    uidValidity: 7,
    messageId: '<id@example.test>',
    threadId: '100',
    fromAddress: 'anna@example.test',
    fromName: 'Anna',
    subject: 'Hej',
    date: '2026-11-05T10:00:00.000Z',
    body: 'Hej, hur mår du?',
    seen: false,
    labels: [],
    ...rest,
    headers: {
      listUnsubscribe: false,
      listId: false,
      precedence: '',
      autoSubmitted: false,
      ...headers,
    },
  }
}

const bucketOf = (overrides: Overrides) =>
  classify(message(overrides)).bucket

describe('sorting into buckets', () => {
  it('treats mail from a person as important', () => {
    assert.equal(bucketOf({}), 'important')
  })

  it('sorts invoices and receipts', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'billing@bredband.example',
        subject: 'Din faktura för november',
        headers: { autoSubmitted: true },
      }),
      'invoices',
    )
    assert.equal(bucketOf({ subject: 'Receipt for your purchase' }), 'invoices')
  })

  it('sorts deliveries by subject and by carrier', () => {
    assert.equal(bucketOf({ subject: 'Ditt paket är på väg' }), 'deliveries')
    assert.equal(
      bucketOf({
        fromAddress: 'info@postnord.se',
        fromName: 'PostNord',
        subject: 'Avisering',
      }),
      'deliveries',
    )
  })

  it('sorts bookings', () => {
    assert.equal(
      bucketOf({ subject: 'Bokningsbekräftelse: tandläkare 14 nov' }),
      'bookings',
    )
  })

  it('sorts bulk mail without sales language as newsletters', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'nyheter@tidning.example',
        subject: 'Veckans mest lästa',
        headers: { listUnsubscribe: true },
      }),
      'newsletters',
    )
  })

  it('sorts bulk mail with sales language as promotions', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'shop@butik.example',
        subject: '20% rabatt på allt, bara idag',
        headers: { listUnsubscribe: true },
      }),
      'promotions',
    )
  })

  it('does not call an invoice from a bulk sender a promotion', () => {
    assert.equal(
      bucketOf({
        subject: 'Din faktura är klar',
        headers: { listUnsubscribe: true },
      }),
      'invoices',
    )
  })

  it('leaves automated, unclassifiable mail in other', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'noreply@tjanst.example',
        subject: 'Din inställning har ändrats',
        headers: { autoSubmitted: true },
      }),
      'other',
    )
  })

  it('lets Gmail mark an automated message as important', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'noreply@tjanst.example',
        subject: 'Svar på ditt ärende',
        labels: ['\\Important'],
        headers: { autoSubmitted: true },
      }),
      'important',
    )
  })

  it('reads Precedence: bulk as bulk mail', () => {
    const result = classify(
      message({
        fromAddress: 'info@butik.example',
        subject: 'Nyheter',
        headers: { precedence: 'bulk' },
      }),
    )
    assert.equal(result.bulk, true)
    assert.equal(result.bucket, 'newsletters')
  })
})

describe('codes', () => {
  it('puts login codes and password resets in their own bucket', () => {
    assert.equal(bucketOf({ subject: 'Din engångskod är 482913' }), 'codes')
    assert.equal(bucketOf({ subject: 'Reset your password' }), 'codes')
    assert.equal(bucketOf({ subject: 'Your code is 123456' }), 'codes')
    assert.equal(bucketOf({ subject: 'Verify your email address' }), 'codes')
  })

  it('does so even from a sender that also sends newsletters', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'noreply@butik.example',
        subject: 'Din verifieringskod',
        headers: { listUnsubscribe: true },
      }),
      'codes',
    )
  })

  it('keeps no snippet for them', () => {
    const record = toRecord(
      message({ subject: 'Din engångskod är 482913', body: 'Koden är 482913' }),
    )
    assert.equal(record.bucket, 'codes')
    assert.equal(record.sensitive, true)
    assert.equal(record.snippet, '')
  })

  it('leaves bank mail in its normal bucket, but sensitive', () => {
    const record = toRecord(
      message({
        fromAddress: 'info@swedbank.se',
        fromName: 'Swedbank',
        subject: 'Din faktura',
      }),
    )
    assert.equal(record.bucket, 'invoices')
    assert.equal(record.sensitive, true)
  })
})

describe('important senders and security notices', () => {
  const auto = { autoSubmitted: true }

  it('puts Google security alerts in important', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'no-reply@accounts.google.com',
        fromName: 'Google',
        subject: 'Säkerhetsvarning',
        headers: auto,
      }),
      'important',
    )
    assert.equal(
      bucketOf({
        fromAddress: 'no-reply@accounts.google.com',
        subject: 'Critical security alert for your linked Google Account',
        headers: auto,
      }),
      'important',
    )
  })

  it('puts Apple account mail in important', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'appleid@id.apple.com',
        fromName: 'Apple',
        subject: 'Ditt Apple-konto har använts för att logga in',
        headers: auto,
      }),
      'important',
    )
  })

  it('puts everything from Kivra in important, even invoices', () => {
    for (const subject of [
      'Du har ny post i Kivra',
      'Faktura från Telia i Kivra',
      'Nytt dokument från Skatteverket',
    ]) {
      assert.equal(
        bucketOf({
          fromAddress: 'noreply@kivra.com',
          fromName: 'Kivra',
          subject,
          headers: auto,
        }),
        'important',
        subject,
      )
    }
  })

  it('still puts a code from these senders in codes', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'no-reply@accounts.google.com',
        subject: 'Din verifieringskod är 482913',
        headers: auto,
      }),
      'codes',
    )
  })

  it('treats a changed password as a security notice, not a code', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'noreply@tjanst.example',
        subject: 'Your password was changed',
        headers: auto,
      }),
      'important',
    )
  })

  it('recognises security notices from any service', () => {
    assert.equal(
      bucketOf({
        fromAddress: 'security@tjanst.example',
        subject: 'Ny inloggning från en okänd enhet',
        headers: auto,
      }),
      'important',
    )
  })

  it('does not promote marketing from the same companies', () => {
    assert.notEqual(
      bucketOf({
        fromAddress: 'news@email.apple.com',
        fromName: 'Apple',
        subject: 'Nytt från Apple: upptäck Vision Pro',
        headers: { listUnsubscribe: true },
      }),
      'important',
    )
    assert.equal(
      bucketOf({
        fromAddress: 'nyheter@tidning.example',
        subject: 'Så skyddar du dig mot a security alert-bluffar',
        headers: { listUnsubscribe: true },
      }),
      'newsletters',
    )
  })

  it('marks Kivra mail as sensitive, so no snippet is kept', () => {
    const record = toRecord(
      message({
        fromAddress: 'noreply@kivra.com',
        fromName: 'Kivra',
        subject: 'Du har ny post i Kivra',
        body: 'Ett brev väntar.',
      }),
    )
    assert.equal(record.sensitive, true)
    assert.equal(record.snippet, '')
  })
})

describe('sensitive mail', () => {
  it('flags login codes and keeps no snippet', () => {
    const record = toRecord(
      message({
        fromAddress: 'noreply@tjanst.example',
        subject: 'Din engångskod är 123456',
        body: 'Använd koden 123456 för att logga in.',
        headers: { autoSubmitted: true },
      }),
    )
    assert.equal(record.sensitive, true)
    assert.equal(record.snippet, '')
  })

  it('flags mail from banks, whatever the subject', () => {
    const record = toRecord(
      message({
        fromAddress: 'info@swedbank.se',
        fromName: 'Swedbank',
        subject: 'Ny information',
        body: 'Saldo och annat känsligt.',
      }),
    )
    assert.equal(record.sensitive, true)
    assert.equal(record.snippet, '')
  })

  it('keeps the snippet for ordinary mail', () => {
    const record = toRecord(message())
    assert.equal(record.sensitive, false)
    assert.equal(record.snippet, 'Hej, hur mår du?')
  })
})

describe('the stored record', () => {
  it('carries the identifying fields through', () => {
    const record = toRecord(message({ seen: true }))
    assert.deepEqual(
      {
        uid: record.uid,
        uidValidity: record.uidValidity,
        seen: record.seen,
        bucket: record.bucket,
      },
      { uid: 1, uidValidity: 7, seen: true, bucket: 'important' },
    )
  })
})
