export function generatePostmanCollection(): any {
  return {
    info: {
      name: 'TL Management API',
      description: 'Enterprise-grade backend with military-grade security',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      version: '4.0.0'
    },
    item: [
      {
        name: 'Auth',
        item: [
          { name: 'Health Check', request: { method: 'GET', url: '{{baseUrl}}/api/v1/health' } },
          { name: 'Get PoW Challenge', request: { method: 'GET', url: '{{baseUrl}}/api/v1/auth/challenge' } },
          { name: 'Register', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/register', body: { mode: 'raw', raw: '{"email":"test@test.com","password":"Test@1234","name":"Test"}' }, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Idempotency-Key', value: '{{$randomUUID}}' }] } },
          { name: 'Login', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/login', body: { mode: 'raw', raw: '{"email":"admin@company.com","password":"Admin@123!"}' }, header: [{ key: 'Content-Type', value: 'application/json' }] } },
          { name: 'Get Me', request: { method: 'GET', url: '{{baseUrl}}/api/v1/auth/me', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'Refresh Token', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/refresh', header: [{ key: 'Cookie', value: 'refresh_token={{refreshToken}}' }] } },
          { name: 'Change Password', request: { method: 'PUT', url: '{{baseUrl}}/api/v1/auth/change-password', body: { mode: 'raw', raw: '{"currentPassword":"Admin@123!","newPassword":"NewPass@123!"}' }, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'Forgot Password', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/forgot-password', body: { mode: 'raw', raw: '{"email":"admin@company.com"}' }, header: [{ key: 'Content-Type', value: 'application/json' }] } },
          { name: 'Reset Password', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/reset-password', body: { mode: 'raw', raw: '{"token":"RESET_TOKEN","password":"NewPass@123!"}' }, header: [{ key: 'Content-Type', value: 'application/json' }] } },
          { name: 'Logout', request: { method: 'POST', url: '{{baseUrl}}/api/v1/auth/logout', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } }
        ]
      },
      {
        name: 'MFA',
        item: [
          { name: 'Setup MFA', request: { method: 'GET', url: '{{baseUrl}}/api/v1/mfa/setup', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'Verify MFA', request: { method: 'POST', url: '{{baseUrl}}/api/v1/mfa/verify', body: { mode: 'raw', raw: '{"token":"123456"}' }, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Cookie', value: 'access_token={{accessToken}}' }] } }
        ]
      },
      {
        name: 'API Keys',
        item: [
          { name: 'Create API Key', request: { method: 'POST', url: '{{baseUrl}}/api/v1/api-keys', body: { mode: 'raw', raw: '{"name":"My Key","scopes":"read,write"}' }, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'List API Keys', request: { method: 'GET', url: '{{baseUrl}}/api/v1/api-keys', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'Revoke API Key', request: { method: 'DELETE', url: '{{baseUrl}}/api/v1/api-keys/1', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } }
        ]
      },
      {
        name: 'Canary Tokens',
        item: [
          { name: 'Deploy Canary', request: { method: 'POST', url: '{{baseUrl}}/api/v1/canary/deploy', body: { mode: 'raw', raw: '{"type":"honeypot","resource":"admin"}' }, header: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Cookie', value: 'access_token={{accessToken}}' }] } },
          { name: 'Canary Registry', request: { method: 'GET', url: '{{baseUrl}}/api/v1/canary/registry', header: [{ key: 'Cookie', value: 'access_token={{accessToken}}' }] } }
        ]
      }
    ],
    variable: [
      { key: 'baseUrl', value: 'http://localhost:5000' },
      { key: 'accessToken', value: '' },
      { key: 'refreshToken', value: '' }
    ]
  };
}
