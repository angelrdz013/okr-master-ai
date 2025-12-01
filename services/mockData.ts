// services/mockData.ts

import { User } from "../types";

export const defaultUser: User = {
  id: "current-user",
  name: "Mi usuario",
  role: "Owner",
  // pon aquí los OKRs que quieras dejar como ejemplo
  okrs: [
    // si ya tenías alguno en el mock, déjalo
  ],
};
