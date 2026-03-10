/**
 * Discord API support for checkbox components may lag behind discord-api-types releases.
 * These local contracts are runtime-validated and serialized as raw component payloads.
 */
export const CHECKBOX_COMPONENT_TYPE = 2002 as const;

export type APICheckboxOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  default?: boolean;
};

export type APICheckboxComponent = {
  type: typeof CHECKBOX_COMPONENT_TYPE;
  custom_id: string;
  disabled?: boolean;
  required?: boolean;
  options: APICheckboxOption[];
};
