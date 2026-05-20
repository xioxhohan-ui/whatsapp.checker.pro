def normalize_bd_number(number: str):
    """
    Normalizes a Bangladesh subscriber phone number.
    
    Rules:
    - Remove spaces, +, -, symbols. Keep digits only.
    - If it starts with 880, strip it off first.
    - If local length is 10, prefix it with 0 to make it 11.
    - Valid carrier prefixes: 013, 014, 015, 016, 017, 018, 019.
    - Return formatted international format: 880XXXXXXXXX, else None.
    """
    if not isinstance(number, str):
        return None

    number = ''.join(filter(str.isdigit, number))

    if number.startswith("880"):
        number = number[3:]

    if len(number) == 10:
        number = "0" + number

    valid_prefixes = ["013","014","015","016","017","018","019"]

    if len(number) == 11 and number[:3] in valid_prefixes:
        return "880" + number[1:]

    return None
