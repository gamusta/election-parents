Feature: Election lifecycle
  An election goes draft → open → closed, never backwards.
  Candidate lists can only change while the election is a draft.

  Background:
    Given a draft election voting from 2026-10-16 08:00 to 2026-10-17 12:00

  Scenario: Opening a draft election with lists during its period
    Given the election has 2 candidate lists
    When the organiser opens it on 2026-10-16 10:00
    Then the election is open

  Scenario: An election without candidate lists cannot be opened
    When the organiser opens it on 2026-10-16 10:00
    Then it is refused with "no_candidate_lists"
    And the election is still a draft

  Scenario: An election cannot be opened before its period
    Given the election has 2 candidate lists
    When the organiser opens it on 2026-10-01 00:00
    Then it is refused with "outside_voting_period"

  Scenario: Candidate lists are frozen once the election is open
    Given the election has 2 candidate lists
    And the organiser opened it on 2026-10-16 10:00
    When the organiser adds a candidate list
    Then it is refused with "election_not_draft"

  Scenario: Closing an election after its period
    Given the election has 2 candidate lists
    And the organiser opened it on 2026-10-16 10:00
    When the organiser closes it on 2026-10-18 00:00
    Then the election is closed

  Scenario: An election cannot be closed before its period ends
    Given the election has 2 candidate lists
    And the organiser opened it on 2026-10-16 10:00
    When the organiser closes it on 2026-10-16 12:00
    Then it is refused with "voting_period_not_ended"

  Scenario: A closed election is never reopened
    Given the election has 2 candidate lists
    And the organiser opened it on 2026-10-16 10:00
    And the organiser closed it on 2026-10-18 00:00
    When the organiser opens it on 2026-10-18 01:00
    Then it is refused with "election_not_draft"