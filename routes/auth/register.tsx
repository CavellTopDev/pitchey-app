import { define } from "../../utils.ts";
import { AuthService, RegisterSchema } from "@/services/auth.service.ts";
import { setCookie } from "$std/http/cookie.ts";

export const handler = define.handlers({
  async POST(req, ctx) {
    const formData = await req.formData();
    const data = Object.fromEntries(formData);
    
    try {
      const result = await AuthService.register(data as any);
      
      // Set cookie
      const headers = new Headers();
      setCookie(headers, {
        name: "auth_token",
        value: result.session.token,
        maxAge: 7 * 24 * 60 * 60, // 7 days
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        path: "/",
      });
      
      headers.set("location", "/dashboard");
      
      return new Response(null, {
        status: 303,
        headers,
      });
    } catch (error) {
      return ctx.render({ error: error.message });
    }
  },
});

export default define.page(function RegisterPage({ data }) {
  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your Pitchey account
          </h2>
        </div>
        <form class="mt-8 space-y-6" method="POST">
          {data?.error && (
            <div class="bg-red-50 text-red-600 p-3 rounded">
              {data.error}
            </div>
          )}
          
          <div class="rounded-md shadow-sm -space-y-px">
            <div>
              <label for="email" class="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label for="username" class="sr-only">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Username"
              />
            </div>
            <div>
              <label for="password" class="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
            <div>
              <label for="userType" class="sr-only">I am a...</label>
              <select
                id="userType"
                name="userType"
                required
                class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              >
                <option value="">Select user type...</option>
                <option value="creator">Creator</option>
                <option value="production">Production Company</option>
                <option value="investor">Investor</option>
              </select>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Sign up
            </button>
          </div>
          
          <div class="text-sm text-center">
            <a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
              Already have an account? Sign in
            </a>
          </div>
        </form>
      </div>
    </div>
  );
});