import json

import pytest

from hostel_management import Hostel


def test_add_room_and_student():
    hostel = Hostel("Test Hostel")
    hostel.add_room("101", 2)
    student = hostel.add_student("Alice", "555-0101", "101", fee_paid=1200)

    assert student.student_id.startswith("STU")
    assert student.room_number == "101"
    assert hostel.get_room("101").occupancy == 1
    assert hostel.monthly_revenue() == 1200.0


def test_full_room_rejects_new_student():
    hostel = Hostel("Test Hostel")
    hostel.add_room("202", 1)
    hostel.add_student("Bob", "555-0102", "202")

    with pytest.raises(ValueError):
        hostel.add_student("Carl", "555-0103", "202")


def test_checkout_student_removes_room_assignment():
    hostel = Hostel("Test Hostel")
    hostel.add_room("303", 2)
    student = hostel.add_student("Dana", "555-0104", "303")
    hostel.checkout_student(student.student_id)

    assert student.room_number is None
    assert student.checked_in is False
    assert hostel.get_room("303").occupancy == 0


def test_hostel_serializes_to_dict_and_json():
    hostel = Hostel("JSON Hostel")
    hostel.add_room("404", 3)
    hostel.add_student("Emma", "555-0105", "404", fee_paid=1300)

    as_dict = hostel.to_dict()
    assert as_dict["name"] == "JSON Hostel"
    assert as_dict["rooms"][0]["room_number"] == "404"

    json_text = json.dumps(as_dict)
    reloaded = Hostel.from_dict(json.loads(json_text))
    assert reloaded.get_room("404").capacity == 3
    assert reloaded.list_students()[0].name == "Emma"


def test_occupancy_rate_and_summary():
    hostel = Hostel("Summary Hostel")
    hostel.add_room("A1", 2)
    hostel.add_room("A2", 4)
    hostel.add_student("Faye", "555-0110", "A1")
    hostel.add_student("Gina", "555-0111", "A2")

    assert hostel.occupancy_rate() == 33.33
    assert hostel.generate_report()["total_residents"] == 2
