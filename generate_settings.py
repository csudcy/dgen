from itertools import combinations
import json
import math
import os

OUTPUT_FILE = os.path.join('.', 'web', 'settings.js')

CARD_RADIUS = 1000
CARD_DIAMETER = CARD_RADIUS * 2
CARD_OUTLINE_WIDTH = 10
CARD_BORDER = 10
CARD_CENTER = CARD_BORDER + CARD_OUTLINE_WIDTH + CARD_RADIUS
CARD_WH = 2*CARD_BORDER + 2*CARD_OUTLINE_WIDTH + CARD_DIAMETER

CARD_OUTLINE_COLOUR = 'blue'
CARD_INNER_COLOUR = 'white'


class Settings(object):
  def __init__(self, items_per_card, centre_image, enclosing_circle_radius):
    self.items_per_card = items_per_card
    self.items_required = items_per_card * (items_per_card - 1) + 1
    self.centre_image = centre_image
    self.image_radius = (1.0 / float(enclosing_circle_radius)) * CARD_RADIUS

# Layout details: https://en.wikipedia.org/wiki/Circle_packing_in_a_circle
SETTINGS = {
  2: Settings(2, False, 2),
  3: Settings(3, False, 2.154),
  4: Settings(4, False, 2.414),
  6: Settings(6, False, 3),
  8: Settings(8, True, 3.304),
}

# Adapted from https://codegolf.stackexchange.com/questions/101229/dobble-spotit-card-generator
def make_combos(settings):
  print 'Making combos for {} items_per_card...'.format(settings.items_per_card)

  items = xrange(settings.items_required)

  used_combos = []
  check_count = 0
  for combo in combinations(items, settings.items_per_card):
    check_count += 1
    if check_count % 100000 == 0:
      print 'Checked {} combinations...'.format(check_count)
    potential_combo = set(combo)
    # Work out if this combination is a valid combination
    # Valid combinations share exactly 1 item with every other card
    valid = all(
      len(existing_combo & potential_combo) == 1
      for existing_combo in used_combos
    )
    if valid:
      used_combos.append(potential_combo)
      print 'Found {} valid combination(s)...'.format(len(used_combos))

  print 'Found {} valid combination(s) out of {} total!'.format(len(used_combos), check_count)

  return used_combos


def make_layout(settings):
  positions = []

  # Add each images radially with layout
  image_count = settings.items_per_card
  centre_image = settings.centre_image
  image_radius = settings.image_radius

  def place_image(angle, offset):
    tl_x = int(CARD_CENTER + math.sin(angle) * offset - image_radius)
    tl_y = int(CARD_CENTER + math.cos(angle) * offset - image_radius)

    positions.append([tl_x, tl_y])

  # If there is a centre image, place it now
  if centre_image:
    place_image(-1, 0, 0)
    image_count -= 1

  # Place all the edge images
  slice_angle = (2 * math.pi) / float(image_count)
  for index in xrange(image_count):
    place_image(index * slice_angle, CARD_RADIUS - image_radius)

  return positions


def generate():
  settings = [
    {
      'items_per_card': info.items_per_card,
      'items_required': info.items_required,
      'combinations': [
        list(combo)
        for combo in make_combos(info)
      ],
      'layout': make_layout(info)
    }
    for info in SETTINGS.itervalues()
  ]

  with open(OUTPUT_FILE, 'w') as f:
    f.write('const SETTINGS = ')
    json.dump(settings, f, sort_keys=True)
    f.write(';')


generate()
