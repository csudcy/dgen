import datetime
import itertools
import math
import pathlib
import pprint
import time

CURRENT_DIRECTORY = pathlib.Path(__file__).parent
OUTPUT_FILE = CURRENT_DIRECTORY / 'docs' /'js' /'settings.js'

CARD_RADIUS = 50


class Settings:

  def __init__(self, items_per_card: int, centre_image: bool, enclosing_circle_radius: float):
    self.items_per_card = items_per_card
    self.items_required = items_per_card * (items_per_card - 1) + 1
    self.centre_image = centre_image
    self.image_radius = (1.0 / float(enclosing_circle_radius)) * CARD_RADIUS

# Layout details: https://en.wikipedia.org/wiki/Circle_packing_in_a_circle
SETTINGS = {
  2: Settings(2, False, 2),
  3: Settings(3, False, 2.154),
  4: Settings(4, False, 2.414),
  5: Settings(5, False, 2.701),
  6: Settings(6, False, 3),
  7: Settings(7, True, 3),
  8: Settings(8, True, 3.304),
}


def _is_prime(number: int) -> bool:
  for i in range(2, int(number**0.5) + 1):
    if number % i == 0:
      return False
  return True


def make_combos(settings: Settings) -> list[set[int]]:
  print()
  print(f'Making combos for {settings.items_per_card} items_per_card...')

  # Optimal algorithm only works where (items_per_card - 1) is prime
  if _is_prime(settings.items_per_card - 1):
    combos = _make_combos_prime(settings)

    # Only the prime algorithm guarantees an optimal arrangement
    print('Checking count...')
    if len(combos) != settings.items_required:
      raise Exception(f'Expected {settings.items_required} combinations, got {len(combos)}!')
  else:
    combos = _make_combos(settings)

  print('Validating matches...')
  for i, card in enumerate(combos):
    for j, other_card in enumerate(combos[i + 1:]):
      common = len(set(card) & set(other_card))
      if common != 1:
        raise Exception(f'Error! Card {i} and {j} have {common} matches!')

  print('Done!')

  return combos


def _n_choose_k(n: int, k: int) -> int:
  n_fac = math.factorial(n)
  k_fac = math.factorial(k)
  n_minus_k_fac = math.factorial(n - k)
  return int(n_fac / (k_fac * n_minus_k_fac))


# Adapted from https://codegolf.stackexchange.com/questions/101229/dobble-spotit-card-generator
def _make_combos(settings: Settings) -> list[set[int]]:
  items = range(settings.items_required)
  combination_count = _n_choose_k(settings.items_required, settings.items_per_card)

  used_combos = []
  check_count = 0
  start_time = time.time()
  next_output = start_time + 1
  has_output_status = False
  for combo in itertools.combinations(items, settings.items_per_card):
    check_count += 1
    if time.time() > next_output:
      next_output = time.time() + 1
      diff_time = time.time() - start_time
      diff_time_td = datetime.timedelta(seconds=int(diff_time))
      combinations_per_second = check_count / diff_time
      remaining_time = (combination_count - check_count) / combinations_per_second
      remaining_time_td = datetime.timedelta(seconds=int(remaining_time))
      pc_done = float(check_count) / float(combination_count) * 100.0
      print(
          f'  {diff_time_td}: Found {len(used_combos)} of {settings.items_required} '
          f'({pc_done:,.2f}% checked, {combinations_per_second:,.2f}/s, {remaining_time_td} remaining) ...',
          end='\r', flush=True)
      has_output_status = True

    potential_combo = set(combo)
    # Work out if this combination is a valid combination
    # Valid combinations share exactly 1 item with every other card
    valid = all(
      len(existing_combo & potential_combo) == 1
      for existing_combo in used_combos
    )
    if valid:
      used_combos.append(potential_combo)

  if has_output_status:
    # Move to next line
    print()

  if len(used_combos) != settings.items_required:
    print(f'***** WARNING: Expected {settings.items_required} valid combinations but found {len(used_combos)} !')

  diff_time = time.time() - start_time
  diff_time_td = datetime.timedelta(seconds=int(diff_time))
  combinations_per_second = check_count / diff_time

  print(f'Found: {len(used_combos)} in {diff_time_td}; checked {check_count:,} at {combinations_per_second:,.2f}/s')

  return used_combos


# Adapted from https://www.101computing.net/the-dobble-algorithm/
def _make_combos_prime(settings: Settings) -> list[set[int]]:
  combos = []
  n = settings.items_per_card - 1
  for i in range(n + 1):  
    #Add new card with first symbol
    combo = [0]
    #Add n+1 symbols on the card (e.g. 8 symbols)
    for j in range(n):
      combo.append((j+1) + (i*n))
    combos.append(combo)

  #Add n sets of n combos 
  for i in range(n):
    for j in range(n):
      #Append a new card with 1 symbol
      combo = [i + 1]
      #Add n symbols on the card (e.g. 7 symbols)
      for k in range(n):
        val  = (n+1 + n*k + (i*k+j) % n)
        combo.append(val)
      combos.append(combo)

  return combos


def make_layout(settings: Settings) -> list[tuple[float, float, float]]:
  positions = []

  # Add each images radially with layout
  image_count = settings.items_per_card
  centre_image = settings.centre_image
  image_radius = settings.image_radius

  def place_image(angle, offset):
    tl_x = CARD_RADIUS + math.sin(angle) * offset - image_radius
    tl_y = CARD_RADIUS + math.cos(angle) * offset - image_radius

    positions.append([tl_x, tl_y, image_radius])

  # If there is a centre image, place it now
  if centre_image:
    place_image(0, 0)
    image_count -= 1

  # Place all the edge images
  slice_angle = (2 * math.pi) / float(image_count)
  for index in range(image_count):
    place_image(index * slice_angle, CARD_RADIUS - image_radius)

  return positions


def generate() -> None:
  settings = {
    info.items_per_card: {
      'items_per_card': info.items_per_card,
      'items_required': info.items_required,
      'combinations': list(sorted([
        list(sorted(combo))
        for combo in make_combos(info)
      ])),
      'layout': make_layout(info)
    }
    for info in SETTINGS.values()
  }

  with open(OUTPUT_FILE, 'w') as f:
    f.write('const SETTINGS = ')
    f.write(pprint.pformat(settings))
    f.write(';\n')


generate()
