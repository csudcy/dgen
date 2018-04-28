from itertools import combinations
from pprint import pprint
import math
import os
import random

from PIL import Image
from PIL import ImageDraw

INPUT_DIRECTORY = os.path.join('.', 'input')

OUTPUT_DIRECTORY = os.path.join('.', 'output')

CARD_RADIUS = 200
CARD_DIAMETER = CARD_RADIUS * 2
CARD_OUTLINE_WIDTH = 10
CARD_BORDER = 10
CARD_CENTER = CARD_BORDER + CARD_OUTLINE_WIDTH + CARD_RADIUS
CARD_WH = 2*CARD_BORDER + 2*CARD_OUTLINE_WIDTH + CARD_DIAMETER

CARD_OUTLINE_COLOUR = 'blue'
CARD_INNER_COLOUR = 'white'

PAGE_CARDS_WIDE = 2
PAGE_CARDS_HIGH = 3
PAGE_CARDS = PAGE_CARDS_WIDE * PAGE_CARDS_HIGH
PAGE_CARD_BORDER_PIXELS = 20
PAGE_WIDTH = PAGE_CARDS_WIDE*CARD_WH + 2*PAGE_CARDS_WIDE*PAGE_CARD_BORDER_PIXELS
PAGE_HEIGHT = PAGE_CARDS_HIGH*CARD_WH + 2*PAGE_CARDS_HIGH*PAGE_CARD_BORDER_PIXELS

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


def test_make_combos():
  for items_per_card in xrange(max(SETTINGS.iterkeys())+1):
    if items_per_card not in SETTINGS:
      continue

    combos = make_combos(settings[items_per_card])

    for combo_1 in combos:
      for combo_2 in combos:
        if combo_1 == combo_2:
          continue
        if len(combo_1 & combo_2) != 1:
          raise Exception('Invalid combination returned: {} : {}'.format(combo_1, combo_2))

    print 'Validated make_combos for {}!'.format(items_per_card)


def load_images(settings):
  print 'Loading images...'
  images = []
  for filename in os.listdir(INPUT_DIRECTORY):
    filepath = os.path.join(INPUT_DIRECTORY, filename)
    print 'Loading "{}"...'.format(filepath)
    try:
      image = Image.open(filepath)

      # Check it's got an alpha mask
      if image.mode != 'RGBA':
        raise Exception('Image must be RGBA (image is {})'.format(image.mode))

      # Check it's approximately square
      if abs(1 - (float(image.height) / float(image.width))) > 0.05:
        raise Exception('Image must be square (image is {} x {})'.format(image.width, image.height))

      images.append(image)
    except Exception, ex:
      print '  Failed: {}'.format(str(ex))

  items_required = settings.items_required
  print 'Loaded {} images; selecting {}...'.format(len(images), items_required)
  return random.sample(images, items_required)


def make_card(settings, combo, images):
  card = Image.new('RGBA', (2*CARD_CENTER, 2*CARD_CENTER))
  draw = ImageDraw.Draw(card)

  # Outline
  draw.ellipse(
    (
      CARD_BORDER, CARD_BORDER,
      CARD_BORDER+2*CARD_OUTLINE_WIDTH+CARD_DIAMETER, CARD_BORDER+2*CARD_OUTLINE_WIDTH+CARD_DIAMETER
    ), fill=CARD_OUTLINE_COLOUR)

  # Inside
  draw.ellipse(
    (
      CARD_BORDER+CARD_OUTLINE_WIDTH, CARD_BORDER+CARD_OUTLINE_WIDTH,
      CARD_BORDER+CARD_OUTLINE_WIDTH+CARD_DIAMETER, CARD_BORDER+CARD_OUTLINE_WIDTH+CARD_DIAMETER
    ), fill=CARD_INNER_COLOUR)

  # Shuffle the combination so images are not always in the same order
  shuffled_combo = list(combo)
  random.shuffle(shuffled_combo)

  # Add each images radially with layout
  image_count = len(shuffled_combo)
  centre_image = settings.centre_image
  image_radius = settings.image_radius

  def place_image(combo_index, angle, offset):
    tl_x = int(CARD_CENTER + math.sin(angle) * offset - image_radius)
    tl_y = int(CARD_CENTER + math.cos(angle) * offset - image_radius)

    image = images[shuffled_combo[combo_index]]
    rotated_image = image.rotate(random.randint(0, 360))
    resized_image = rotated_image.resize((int(image_radius*2), int(image_radius*2)))

    card.paste(resized_image, (tl_x, tl_y), resized_image)

  # If there is a centre image, place it now
  if centre_image:
    place_image(-1, 0, 0)
    image_count -= 1

  # Place all the edge images
  slice_angle = (2 * math.pi) / float(image_count)
  for index in xrange(image_count):
    place_image(index, index * slice_angle, CARD_RADIUS - image_radius)

  return card


def make_page(card_page):
  page = Image.new('RGBA', (PAGE_WIDTH, PAGE_HEIGHT))

  card_index = 0
  for x in xrange(PAGE_CARDS_WIDE):
    if card_index >= len(card_page):
      break
    for y in xrange(PAGE_CARDS_HIGH):
      if card_index >= len(card_page):
        break

      tl_x = PAGE_CARD_BORDER_PIXELS + x * (CARD_WH + PAGE_CARD_BORDER_PIXELS)
      tl_y = PAGE_CARD_BORDER_PIXELS + y * (CARD_WH + PAGE_CARD_BORDER_PIXELS)

      card = card_page[card_index]
      page.paste(card, (tl_x, tl_y), card)

      card_index += 1

  return page


def make_pages(cards):
  return [
    make_page(cards[index:index + PAGE_CARDS])
    for index in xrange(0, len(cards), PAGE_CARDS)
  ]


def clear_output_directory():
  for filename in os.listdir(OUTPUT_DIRECTORY):
    filepath = os.path.join(OUTPUT_DIRECTORY, filename)

    print 'Deleting {}...'.format(filepath)
    try:
      os.remove(filepath)
    except Exception, ex:
      print '  Failed: {}'.format(str(ex))


def output_images(images, filename_template):
  for index, image in enumerate(images):
    filename = filename_template.format(index)
    filepath = os.path.join(OUTPUT_DIRECTORY, filename)

    print 'Saving {}...'.format(filepath)
    image.save(filepath)


def generate(items_per_card):
  settings = SETTINGS[items_per_card]
  images = load_images(settings)
  combos = make_combos(settings)
  cards = [
    make_card(settings, combo, images)
    for combo in combos
  ]
  pages = make_pages(cards)

  clear_output_directory()
  output_images(cards, 'card_{}.png')
  output_images(pages, 'page_{}.png')

# test_make_combos()
# generate(2)
# generate(3)
# generate(4)
generate(6)
