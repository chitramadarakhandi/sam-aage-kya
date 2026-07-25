/**
 * Guards the shared location display helper (src/utils/location.js).
 * Union territories store city === state, which used to render "Delhi · Delhi".
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { formatLocation, formatCityState, dedupeLocationParts } from '../src/utils/location.js'

test('city === state collapses to a single value', () => {
  assert.equal(formatLocation(['Delhi', 'Delhi', 'central']), 'Delhi · central')
  assert.equal(formatLocation([' delhi ', 'Delhi']), 'delhi')
  assert.equal(formatCityState('Delhi', 'Delhi'), 'Delhi')
  assert.equal(formatCityState('Puducherry', 'puducherry'), 'Puducherry')
})

test('distinct city and state still render both', () => {
  assert.equal(formatLocation(['Bangalore', 'Karnataka', 'private']), 'Bangalore · Karnataka · private')
  assert.equal(formatCityState('Bangalore', 'Karnataka'), 'Bangalore, Karnataka')
})

test('empty and missing values are dropped', () => {
  assert.equal(formatLocation([null, 'Karnataka', undefined, '  ']), 'Karnataka')
  assert.equal(formatCityState('', 'Bihar'), 'Bihar')
  assert.deepEqual(dedupeLocationParts([]), [])
  assert.equal(formatLocation(undefined), '')
})
