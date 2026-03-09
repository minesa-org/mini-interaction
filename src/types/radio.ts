/**
 * Discord API support for radio components may lag behind discord-api-types releases.
 * These local contracts are runtime-validated and serialized as raw component payloads.
 */
export const RADIO_COMPONENT_TYPE = 2001 as const;

export type APIRadioOption = {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  default?: boolean;
};

export type APIRadioComponent = {
  type: typeof RADIO_COMPONENT_TYPE;
  custom_id: string;
  disabled?: boolean;
  required?: boolean;
  options: APIRadioOption[];
};
