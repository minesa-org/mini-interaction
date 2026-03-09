import test from 'node:test';
import assert from 'node:assert/strict';
import { LabelBuilder } from '../LabelBuilder.js';
import { TextInputBuilder } from '../TextInputBuilder.js';
import { FileUploadBuilder } from '../FileUploadBuilder.js';
import { ModalBuilder } from '../ModalBuilder.js';
import { ModalRoleSelectMenuBuilder } from '../ModalRoleSelectMenuBuilder.js';
import { RadioBuilder } from '../RadioBuilder.js';
import { ComponentType, TextInputStyle } from 'discord-api-types/v10';

test('TextInputBuilder validation and snapshot', () => {
  const json = new TextInputBuilder().setCustomId('name').setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(20).toJSON();
  assert.equal(json.type, ComponentType.TextInput);
  assert.match(JSON.stringify(json), /"custom_id":"name"/);
});

test('LabelBuilder throws descriptive errors', () => {
  assert.throws(() => new LabelBuilder().toJSON(), /\[LabelBuilder\] label/);
});

test('FileUploadBuilder min > max fails', () => {
  assert.throws(() => new FileUploadBuilder().setCustomId('upload').setMinValues(3).setMaxValues(1).toJSON(), /min_values/);
});

test('ModalBuilder validates nesting', () => {
  const text = new TextInputBuilder().setCustomId('x').toJSON();
  assert.throws(() => new ModalBuilder().setCustomId('id').setTitle('t').addComponents(text as never).toJSON(), /invalid modal top-level/);
});

test('ModalRoleSelectMenuBuilder serializes', () => {
  const json = new ModalRoleSelectMenuBuilder().setCustomId('role').setMinValues(1).setMaxValues(1).toJSON();
  assert.equal(json.type, ComponentType.RoleSelect);
});

test('RadioBuilder single default rule', () => {
  assert.throws(() => new RadioBuilder().setCustomId('r').addOptions({ label: 'A', value: 'a', default: true }, { label: 'B', value: 'b', default: true }).toJSON(), /only one default/);
});
