// Types pour les erreurs d'API Axios
export interface AxiosErrorResponse {
  response?: {
    data?: {
      message?: string;
      detail?: string;
      [key: string]: unknown;
    };
    status?: number;
  };
  message?: string;
}

// Fonction utilitaire pour extraire le message d'erreur d'une réponse Axios
export function getAxiosErrorMessage(error: unknown): string {
  const axiosError = error as AxiosErrorResponse;
  return axiosError.response?.data?.message || 
         axiosError.response?.data?.detail ||
         axiosError.message ||
         'Une erreur est survenue';
}
