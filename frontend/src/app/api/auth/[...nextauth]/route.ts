import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const HOST = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        action: { label: "Action", type: "text" } // login or register
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        
        try {
            const endpoint = credentials.action === 'register' ? '/api/users/register' : '/api/users/login';
            const payload = credentials.action === 'register' 
                ? { email: credentials.email, password: credentials.password, name: credentials.name }
                : { email: credentials.email, password: credentials.password };

            const res = await fetch(`${HOST}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (res.ok && data.user) {
              return { id: data.user.id, name: data.user.name, email: data.user.email, apiToken: data.token };
            }
            return null;
        } catch {
            return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.apiToken = (user as any).apiToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = token.id as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).apiToken = token.apiToken;
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt'
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_dev_secret_key_123',
  pages: {
    signIn: '/' 
  }
});

export { handler as GET, handler as POST };
