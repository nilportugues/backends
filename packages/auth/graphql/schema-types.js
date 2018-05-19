module.exports = `

type Session {
  id: ID!
  ipAddress: String!
  userAgent: String
  email: String!
  expiresAt: DateTime!
  country: String
  countryFlag: String
  city: String
  isCurrent: Boolean!
  phrase: String
}

type UnauthorizedSession {
  session: Session!
  enabledSecondFactors: [SignInTokenType]!
  requiredConsents: [String!]!
  newUser: Boolean
}

type User {
  id: ID!
  initials: String
  username: String
  name: String
  firstName: String
  lastName: String
  email: String
  hasPublicProfile: Boolean
  roles: [String!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  sessions: [Session!]
  enabledSecondFactors: [SignInTokenType]!
  eventLog: [EventLog!]!
}

type SignInResponse {
  phrase: String!
}

type SharedSecretResponse {
  secret: String!
  otpAuthUrl: String!
  svg(errorCorrectionLevel: QRCodeErrorCorrectionLevel = M): String!
}

# Error Correction Level for QR Images
# http://qrcode.meetheed.com/question17.php
enum QRCodeErrorCorrectionLevel {
  L
  M
  Q
  H
}

enum SignInTokenType {
  EMAIL_TOKEN
  TOTP
  SMS
}

input SignInToken {
  type: SignInTokenType!
  payload: String!
}

type RequestInfo {
  ipAddress: String!
  userAgent: String
  country: String
  countryFlag: String
  city: String
}

enum EventLogType {
  TOKEN_REQUEST
  TOKEN_RE_REQUEST
  ROLL_SESSION
  AUTHORIZE_SESSION
  DENY_SESSION
  SIGNOUT_TIMEOUT
  UNKNOWN
}

type EventLog {
  type: EventLogType
  archivedSession: Session
  activeSession: Session
  createdAt: DateTime!
}
`
