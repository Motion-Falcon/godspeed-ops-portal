import axios from "axios";
import { api } from "./index";

export const inviteRecruiterAPI = async (email: string, name: string) => {
  try {
    const response = await api.post("/api/users/invite-recruiter", { email, name });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.error || "Failed to send invitation");
    }
    throw error;
  }
};

export const resendInvitationAPI = async (userId: string) => {
  try {
    const response = await api.post("/api/users/resend-invitation", { userId });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data?.error || "Failed to resend invitation");
    }
    throw error;
  }
};

// Get all auth users with filters and pagination
export const getAllAuthUsersAPI = async (
  params: {
    page?: number;
    limit?: number;
    search?: string;
    nameFilter?: string;
    emailFilter?: string;
    mobileFilter?: string;
    userTypeFilter?: string;
    emailVerifiedFilter?: string;
    userRoleFilter?: string;
    managerIdFilter?: string;
  } = {}
) => {
  try {
    const response = await api.get("/api/users", { params });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch auth users"
      );
    }
    throw error;
  }
};

// Get single auth user by ID
export const getAuthUserByIdAPI = async (id: string) => {
  try {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch auth user"
      );
    }
    throw error;
  }
};

// Set a user's manager (hierarchy.manager_id)
export const setUserManagerAPI = async (
  id: string,
  managerId: string | null
) => {
  try {
    const response = await api.patch(`/api/users/${id}/manager`, { managerId });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update user's manager"
      );
    }
    throw error;
  }
};

// Set a user's roles (user_metadata.user_role)
export const setUserRolesAPI = async (
  id: string,
  roles: string[]
) => {
  try {
    const response = await api.patch(`/api/users/${id}/roles`, { roles });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update user's roles"
      );
    }
    throw error;
  }
};