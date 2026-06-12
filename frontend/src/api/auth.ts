import client, { ApiResponse } from "./client";

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

export async function register(request: RegisterRequest): Promise<User> {
  const { data } = await client.post<ApiResponse<User>>("/auth/register", request);
  return data.result;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const { data } = await client.post<ApiResponse<AuthResult>>("/auth/login", {
    email,
    password,
  });
  return data.result;
}

export async function logout(): Promise<void> {
  await client.post("/auth/logout");
}

export async function getProfile(): Promise<User> {
  const { data } = await client.get<ApiResponse<User>>("/users/me");
  return data.result;
}

export async function updateProfile(fullName: string): Promise<User> {
  const { data } = await client.put<ApiResponse<User>>("/users/me", { fullName });
  return data.result;
}
