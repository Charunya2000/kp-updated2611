import NextAuth from "next-auth";
import { v4 as generateGuid } from "uuid";

const state = generateGuid();

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 60
  },
  providers: [
    {
      id: "aiportal",
      name: "Ping ID",
      type: "oauth",
      version: "2.0",
      scope: "openid email profile",
      params: { grant_type: "authorization_code" },
      accessTokenUrl: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/token.oauth2`,
      requestTokenUrl: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/authorization.oauth2?response_type=code&client_id=${process.env.FAM_CLIENT_ID}&scope=openid email profile&redirect_uri=${process.env.NEXTAUTH_CALLBACK_URL}&state=${state}`,
      authorization: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/authorization.oauth2?response_type=code&client_id=${process.env.FAM_CLIENT_ID}&scope=openid email profile&redirect_uri=${process.env.NEXTAUTH_CALLBACK_URL}&state=${state}`,
      profileUrl: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/idp/userinfo.openid`,
      userinfo: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/idp/userinfo.openid`,
      token: {
        url: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/as/token.oauth2`,
      },
      issuer: `${process.env.NEXT_PUBLIC_FAM_PREFIX}`,
      jwks_endpoint: `${process.env.NEXT_PUBLIC_FAM_PREFIX}/pf/JWKS`,
      clientId: process.env.FAM_CLIENT_ID,
      clientSecret: process.env.FAM_CLIENT_SECRET,
      async profile(profile, tokens) {
        return {
          id: profile.sub?.toUpperCase(),
          email: profile.email.toUpperCase(),
          firstName: profile.firstName,
          lastName: profile.lastName,
        };
      },
    },
  ],
  callbacks: {
    async session({ session, user, token }) {
      if (token.nuid || token.email.toUpperCase()) {
        session.nuid = token.nuid?.toUpperCase() || token.email?.toUpperCase();
        session.firstName = token.firstName;
        session.lastName = token.lastName;
        session.email = token.email.toUpperCase();
        session.groups = token.groups;
      }
      return session;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (profile) {
        token.nuid = profile.sub?.toUpperCase();
        token.email = profile.email?.toUpperCase();
        token.firstName = profile.firstName;
        token.lastName = profile.lastName;
        token.groups = profile.groups;
      }
      return token;
    },
    async signIn({ user, account, profile, email, credentials }) {
      fetch(`${process.env.NEXTAUTH_URL}/api/user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true',
          'x-internal-secret': process.env.AUTH_SECRET,
        },
        body: JSON.stringify({
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email.toUpperCase(),
          nuid: profile.sub?.toUpperCase(),
          groups: profile.groups
        }),
      }).catch(error => console.error({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'signIn', detail: { error } } }));

      return true;
    }
  },
});