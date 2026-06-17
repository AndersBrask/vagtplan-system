from datetime import datetime, timedelta


_TIME_FORMAT = "%H:%M"


def parse_time(t: str) -> datetime:
    return datetime.strptime(t, _TIME_FORMAT)


def format_time(dt: datetime) -> str:
    return dt.strftime(_TIME_FORMAT)


def add_minutes(t: str, minutes: int) -> str:
    dt = parse_time(t) + timedelta(minutes=minutes)
    return format_time(dt)


def generate_time_slots(start: str, end: str, slot_minutes: int):
    """
    Generator, der giver (slot_start_str, slot_end_str) for hele intervallet.
    """
    current = parse_time(start)
    end_dt = parse_time(end)
    while current < end_dt:
        slot_start = current
        slot_end = current + timedelta(minutes=slot_minutes)
        yield format_time(slot_start), format_time(slot_end)
        current = slot_end
