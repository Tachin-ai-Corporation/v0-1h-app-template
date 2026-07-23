import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const organizationLabels = {
  labOrganizations: "Lab Organization",
  healthcareOrganizations: "Healthcare Organization",
  supplierOrganizations: "Supplier Organization",
} as const
