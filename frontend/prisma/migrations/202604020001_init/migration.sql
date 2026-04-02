CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ContextOwnerType" AS ENUM ('ORGANIZATION', 'TEAM', 'EMPLOYEE');
CREATE TYPE "AuditAction" AS ENUM ('ORGANIZATION_CREATED', 'TEAM_CREATED', 'EMPLOYEE_CREATED', 'EDGE_CREATED', 'NODE_MOVED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "image" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Organization" (
  "id" TEXT PRIMARY KEY,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "instructions" TEXT NOT NULL DEFAULT '',
  "context" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Team" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "parentTeamId" TEXT REFERENCES "Team"("id"),
  "name" TEXT NOT NULL,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "instructions" TEXT NOT NULL DEFAULT '',
  "context" TEXT NOT NULL DEFAULT '',
  "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Employee" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "managerId" TEXT REFERENCES "Employee"("id"),
  "name" TEXT NOT NULL,
  "title" TEXT,
  "attributes" JSONB NOT NULL DEFAULT '{}',
  "instructions" TEXT NOT NULL DEFAULT '',
  "context" TEXT NOT NULL DEFAULT '',
  "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "Capability" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "EmployeeCapability" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "capabilityId" TEXT NOT NULL REFERENCES "Capability"("id") ON DELETE CASCADE,
  "grantedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("employeeId", "capabilityId")
);

CREATE TABLE "TeamEdge" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "sourceTeamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "targetTeamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "EmployeeEdge" (
  "id" TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL REFERENCES "Team"("id") ON DELETE CASCADE,
  "sourceEmployeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "targetEmployeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ContextSource" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "ownerType" "ContextOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "action" "AuditAction" NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,
  UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "expires" TIMESTAMP(3) NOT NULL,
  UNIQUE ("identifier", "token")
);

CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");
CREATE INDEX "Team_organizationId_idx" ON "Team"("organizationId");
CREATE INDEX "Employee_teamId_idx" ON "Employee"("teamId");
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");
CREATE INDEX "TeamEdge_organizationId_idx" ON "TeamEdge"("organizationId");
CREATE INDEX "EmployeeEdge_teamId_idx" ON "EmployeeEdge"("teamId");
CREATE INDEX "ContextSource_organizationId_ownerType_idx" ON "ContextSource"("organizationId", "ownerType");
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
