
import { apiRequest } from "@/lib/api";

export type Customer = {
  id: number;
  name: string | null;
  email: string;
  photo_url: string | null;
  email_verified: boolean;
  role: "customer";
};

export type AuthStatus = {
  authenticated: boolean;
  customer: Customer | null;
};

export type CustomerCredentials = {
  email: string;
  password: string;
};

export type CustomerSignupData = CustomerCredentials & {
  name: string;
};

export async function getCustomerSession(): Promise<AuthStatus> {
  return apiRequest<AuthStatus>("/auth/me", {
    method: "GET",
    cache: "no-store",
  });
}

export async function loginCustomer(
  credentials: CustomerCredentials,
): Promise<Customer> {
  const customer = await apiRequest<Customer>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });

  return customer;
}

export async function signupCustomer(
  data: CustomerSignupData,
): Promise<Customer> {
  return apiRequest<Customer>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logoutCustomer(): Promise<void> {
  await apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
  });
}
