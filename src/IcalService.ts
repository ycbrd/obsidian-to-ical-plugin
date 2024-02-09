import { Task } from './Model/Task';
import { TaskDateName } from './Model/TaskDate';
import { TaskStatus } from './Model/TaskStatus';

export class IcalService {
  private howToProcessMultipleDates: string;

  constructor(howToProcessMultipleDates: string) {
    this.howToProcessMultipleDates = howToProcessMultipleDates;
  }

  getCalendar(tasks: Task[], includeTodos: boolean): string {
    const events = this.getEvents(tasks);
    const toDos = includeTodos ? this.getToDos(tasks) : '';

    let calendar = '' +
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'PRODID:-//Andrew Brereton//obsidian-ical-plugin v1.14.1//EN\r\n' +
      'X-WR-CALNAME:Obsidian Calendar\r\n' +
      'NAME:Obsidian Calendar\r\n' +
      'CALSCALE:GREGORIAN\r\n' +
      events +
      toDos +
      'END:VCALENDAR\r\n'
      ;

    calendar = this.pretty(calendar);

    return calendar;
  }

  private getEvents(tasks: Task[]): string {
    return tasks
      .map((task: Task) => {
        return this.getEvent(task, null, '');
      })
      .join('');
  }

  private getEvent(task: Task, date: string|null, prependSummary: string): string {
    // console.log({task});

    // This task does not have a date.
    // Therefore it must be included because it is a TODO and isIncludeTodos setting is true.
    // Don't add it to the VEVENT block, as it will be added to the VTODO block later.
    if (task.hasAnyDate() === false) {
      return '';
    }

    let event = '' +
      'BEGIN:VEVENT\r\n' +
      'UID:' + task.getId() + '\r\n' +
      'DTSTAMP:' + task.getDate(null, 'YYYYMMDDTHHmmss') + '\r\n';

    if (date === null) {

      switch (this.howToProcessMultipleDates) {

        // User would prefer to use the task's start date
        // If a start date does not exist, take the due date
        // If a due date does not exist, take any old date that we can find
        case 'PreferStartDate':
          if (task.hasA(TaskDateName.Start)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.Start, 'YYYYMMDD') + '\r\n';
          } else if (task.hasA(TaskDateName.Due)) {
            event += 'DTSTART:' + task.getDate(TaskDateName.Due, 'YYYYMMDD') + '\r\n';
          } else {
            event += 'DTSTART:' + task.getDate(null, 'YYYYMMDD') + '\r\n';
          }

          break;

        // User would prefer to create an event per task date
        // If there is a start date, then create an event for it
        // If there is a schedule date, then create an event for it
        // If there is a due date, then create an event for it
        // If there are no events, then take any old date that we can find
        case 'CreateMultipleEvents':
          let events = '';

          if (task.hasA(TaskDateName.Start)) {
            events += this.getEvent(task, task.getDate(TaskDateName.Start, 'YYYYMMDD'), '🛫 ');
          }

          if (task.hasA(TaskDateName.Scheduled)) {
            events += this.getEvent(task, task.getDate(TaskDateName.Scheduled, 'YYYYMMDD'), '⏳ ');
          }

          if (task.hasA(TaskDateName.Due)) {
            events += this.getEvent(task, task.getDate(TaskDateName.Due, 'YYYYMMDD'), '📅 ');
          }

          if (event === '') {
            events += this.getEvent(task, task.getDate(null, 'YYYYMMDD'), '');
          }

          return events;

          break;

        // User would prefer to use the task's due date
        // If there is a start and due date, set the start to the start date and the end to the due date
        // If a start and due date does not exist, take the due date
        // If a due date does not exist, take the start date
        // If a start date does not exist, take any old date that we can find
        case 'PreferDueDate':
        default:
          if (task.hasA(TaskDateName.Start) && task.hasA(TaskDateName.Due)) {
            event += '' +
              'DTSTART:' + task.getDate(TaskDateName.Start, 'YYYYMMDDTHHmmss') + '\r\n' +
              'DTEND:' + task.getDate(TaskDateName.Due, 'YYYYMMDDTHHmmss') + '\r\n';
          } else if (task.hasA(TaskDateName.Due)) {
            event += '' +
              'DTSTART:' + task.getDate(TaskDateName.Due, 'YYYYMMDD') + '\r\n';
          } else if (task.hasA(TaskDateName.Start)) {
            event += '' +
              'DTSTART:' + task.getDate(TaskDateName.Start, 'YYYYMMDD') + '\r\n';
          } else {
            event += '' +
              'DTSTART:' + task.getDate(null, 'YYYYMMDD') + '\r\n';
          }

          break;
      }
    } else {
      // Date has been given to this function which means we are being called recursively due to CreateMultipleEvents
      event += '' +
        'DTSTART:' + date + '\r\n';
    }

    event += '' +
      'SUMMARY:' + prependSummary + task.getSummary() + '\r\n' +
      'LOCATION:ALTREP="' + encodeURI(task.getLocation()) + '":' + encodeURI(task.getLocation()) + '\r\n' +
      'END:VEVENT\r\n';

    return event;
  }

  private getToDos(tasks: Task[]): string {
    return tasks
      .map((task: Task) => {
        return this.getToDo(task);
      })
      .join('');
  }

  private getToDo(task: Task): string {
    let toDo = '' +
      'BEGIN:VTODO\r\n' +
      'UID:' + task.getId() + '\r\n' +
      'SUMMARY:' + task.getSummary() + '\r\n' +
      // If a task does not have a date, do not include the DTSTAMP property
      (task.hasAnyDate() ? 'DTSTAMP:' + task.getDate(null, 'YYYYMMDDTHHmmss') + '\r\n' : '')
      'LOCATION:ALTREP="' + encodeURI(task.getLocation()) + '":' + encodeURI(task.getLocation()) + '\r\n';

    if (task.hasA(TaskDateName.Due)) {
      toDo += 'DUE;VALUE=DATE:' + task.getDate(TaskDateName.Due, 'YYYYMMDD') + '\r\n';
    }

    if (task.hasA(TaskDateName.Done)) {
      toDo += 'COMPLETED;VALUE=DATE:' + task.getDate(TaskDateName.Done, 'YYYYMMDD') + '\r\n';
    }

    switch (task.status) {
      case TaskStatus.ToDo:
        toDo += 'STATUS:NEEDS-ACTION\r\n';
        break;
      case TaskStatus.InProgress:
        toDo += 'STATUS:IN-PROCESS\r\n';
        break;
      case TaskStatus.Done:
        toDo += 'STATUS:COMPLETED\r\n';
        break;
      case TaskStatus.Cancelled:
        toDo += 'STATUS:CANCELLED\r\n';
        break;
    }

    toDo += 'END:VTODO\r\n';

    return toDo;
  }

  private pretty(calendar: string): string {
    // Replace two or more /r or /n or /r/n with a single CRLF
    calendar = calendar.replace('/\R{2,}/', '\r\n');

    // Ensure all line endings are CRLF. Have to do 'BSR_ANYCRLF' so we don't break emojis
    calendar = calendar.replace('~(*BSR_ANYCRLF)\R~', '\r\n');

    // Line length should not be longer than 75 characters (https://icalendar.org/iCalendar-RFC-5545/3-1-content-lines.html)
    //#TODO I can't be bothered implementing this *should* requirement

    // Ensure we are UTF-8
    calendar = Buffer.from(calendar, 'utf8').toString('utf8');

    return calendar;
  }
}
