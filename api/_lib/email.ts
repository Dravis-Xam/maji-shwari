const env =
  (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {}

export async function sendVerificationCode(
  email: string,
  name: string,
  code: string,
): Promise<{ sent: boolean }> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.log(`[demo email] MajiShwari verification code for ${email}: ${code}`)
    return { sent: false }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: email,
        subject: 'Your MajiShwari verification code',
        text: `Hi ${name},\n\nYour MajiShwari verification code is ${code}.\nIt expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
      }),
    })

    if (!response.ok) {
      console.error('email_send_failed', response.status, await response.text())
      return { sent: false }
    }

    return { sent: true }
  } catch (error) {
    console.error('email_send_error', error)
    return { sent: false }
  }
}