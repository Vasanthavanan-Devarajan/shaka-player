/*! @license
 * Shaka Player
 * Copyright 2016 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */


describe('Cea708Window', () => {
  const CeaUtils = shaka.test.CeaUtils;

  /** @type {!shaka.cea.Cea708Window} */
  let window;

  /** @type {number} */
  const serviceNumber = 1; // We will arbitrarily pick service 1 for all tests.

  /** @type {string} */
  const stream = `svc${serviceNumber}`;

  /** @type {number} */
  const rowCount = 10;

  /** @type {number} */
  const colCount = 32;

  /** @type {number} */
  const startTime = 1;

  /** @type {number} */
  const endTime = 2;

  beforeEach(() => {
    window = new shaka.cea.Cea708Window(/* windowNum= */ 0, serviceNumber);
    window.defineWindow(
        /* visible= */ true, /* verticalAnchor= */ 0,
        /* horAnchor= */ 0, /* anchorId= */ 0, /* relativeToggle= */ false,
        rowCount, colCount);
    window.setStartTime(startTime);
  });

  it('adds and emits a series of characters from the buffer', () => {
    const text = 'test word';
    for (const c of text) {
      window.setCharacter(c);
    }

    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createDefaultCue(startTime, endTime, text),
    ];

    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };

    expect(caption).toEqual(expectedCaption);
  });

  describe('handles carriage returns', () => {
    it('handles a regular carriage return', () => {
      const text1 = 'test';
      const text2 = 'word';
      for (const c of text1) {
        window.setCharacter(c);
      }
      window.carriageReturn();
      for (const c of text2) {
        window.setCharacter(c);
      }

      const caption = window.forceEmit(endTime, serviceNumber);

      const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
          serviceNumber, 0, rowCount, colCount);
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text1),
        CeaUtils.createLineBreakCue(startTime, endTime),
        CeaUtils.createDefaultCue(startTime, endTime, text2),
      ];

      const expectedCaption = {
        stream,
        cue: topLevelCue,
      };

      expect(caption).toEqual(expectedCaption);
    });

    it('handles a carriage return on the last row of the buffer', () => {
      const text1 = 'test';
      const text2 = 'word';

      // Set the pen location to the very last row in the buffer.
      window.setPenLocation(/* row= */ rowCount-1, /* col= */ 0);

      for (const c of text1) {
        window.setCharacter(c);
      }
      window.carriageReturn();
      for (const c of text2) {
        window.setCharacter(c);
      }

      const caption = window.forceEmit(endTime, serviceNumber);

      const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
          serviceNumber, 0, rowCount, colCount);
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text1),
        CeaUtils.createLineBreakCue(startTime, endTime),
        CeaUtils.createDefaultCue(startTime, endTime, text2),
      ];

      const expectedCaption = {
        stream,
        cue: topLevelCue,
      };

      expect(caption).toEqual(expectedCaption);
    });

    it('handles a horizontal carriage return', () => {
      const text = 'test';

      for (const c of text) {
        window.setCharacter(c);
      }
      window.horizontalCarriageReturn();

      const caption = window.forceEmit(endTime, serviceNumber);

      // Nothing should have emitted, a horizontal carriage return wipes the row
      // and sets the column position to the beginning of the row.
      expect(caption).toBe(null);
    });
  });

  it('handles pen styling including colors, underlines, italics', () => {
    const text1 = 'style1';
    const text2 = 'style2';
    const text3 = 'style3';
    const textColor1 = 'red';
    const textColor2 = 'yellow';
    const backgroundColor1 = 'blue';
    const backgroundColor2 = 'magenta';
    // Set the pen to an underlined, italicized red color.
    window.setPenItalics(true);
    window.setPenUnderline(true);
    window.setPenTextColor('red');
    for (const c of text1) {
      window.setCharacter(c);
    }

    // Remove the underline and italics, and set the background color to blue.
    window.setPenItalics(false);
    window.setPenUnderline(false);
    window.setPenBackgroundColor('blue');
    for (const c of text2) {
      window.setCharacter(c);
    }

    // Turn underline on again, make the text yellow and background magenta.
    window.setPenUnderline(true);
    window.setPenTextColor('yellow');
    window.setPenBackgroundColor('magenta');
    for (const c of text3) {
      window.setCharacter(c);
    }

    // These three stylings should correspond to three nested cues.
    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createStyledCue(startTime, endTime, text1, /* underline= */ true,
          /* italics= */ true, textColor1,
          shaka.cea.CeaUtils.DEFAULT_BG_COLOR),
      CeaUtils.createStyledCue(startTime, endTime, text2,
          /* underline= */ false, /* italics= */ false,
          textColor1, backgroundColor1),
      CeaUtils.createStyledCue(startTime, endTime, text3, /* underline= */ true,
          /* italics= */ false, textColor2, backgroundColor2),
    ];

    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };

    expect(caption).toEqual(expectedCaption);
  });

  describe('handles justification of cues', () => {
    const text = 'test';
    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    it('justifies the text left', () => {
      for (const c of text) {
        window.setCharacter(c);
      }

      // Left-justified.
      window.setJustification(shaka.cea.Cea708Window.TextJustification.LEFT);
      topLevelCue.textAlign = shaka.text.Cue.textAlign.LEFT;
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];
      const expectedCaption = {
        stream,
        cue: topLevelCue,
      };

      const caption = window.forceEmit(endTime, serviceNumber);
      expect(caption).toEqual(expectedCaption);
    });

    it('justifies the text right', () => {
      for (const c of text) {
        window.setCharacter(c);
      }

      // Right-justified.
      window.setJustification(shaka.cea.Cea708Window.TextJustification.RIGHT);
      topLevelCue.textAlign = shaka.text.Cue.textAlign.RIGHT;
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];
      const expectedCaption = {
        stream,
        cue: topLevelCue,
      };

      const caption = window.forceEmit(endTime, serviceNumber);
      expect(caption).toEqual(expectedCaption);
    });

    it('default justification should be centered', () => {
      for (const c of text) {
        window.setCharacter(c);
      }
      topLevelCue.textAlign = shaka.text.Cue.textAlign.CENTER;
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];
      const expectedCaption = {
        stream,
        cue: topLevelCue,
      };

      const caption = window.forceEmit(endTime, serviceNumber);
      expect(caption).toEqual(expectedCaption);
    });
  });

  it('resets the pen correctly', () => {
    const text1 = 'abcd';
    // cspell: disable-next-line
    const text2 = 'efgh';

    // Set some styles on the pen and add the first text to window.
    window.setPenUnderline(true);
    window.setPenBackgroundColor('blue');
    for (const c of text1) {
      window.setCharacter(c);
    }

    // Reset the pen and add the second text to window.
    window.resetPen();
    for (const c of text2) {
      window.setCharacter(c);
    }

    // The second text should have overwritten the first text,
    // and all the styles should have been cleared.
    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createDefaultCue(startTime, endTime, text2),
    ];
    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };
    expect(caption).toEqual(expectedCaption);
  });

  it('handles the backspace command to backspace text correctly', () => {
    // cspell: disable-next-line
    const text = 'testt';
    const backspacedText = 'test';

    for (const c of text) {
      window.setCharacter(c);
    }
    window.backspace();

    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createDefaultCue(startTime, endTime, backspacedText),
    ];
    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };
    expect(caption).toEqual(expectedCaption);
  });

  it('correctly sets pen location', () => {
    const text1 = 'test';
    const text2 = 'word';
    const text3 = 'on new line';
    for (const c of text1) {
      window.setCharacter(c);
    }

    window.setPenLocation(/* row= */ 0, /* col= */ 6);
    for (const c of text2) {
      window.setCharacter(c);
    }

    window.setPenLocation(/* row= */ 3, /* col= */ 0);
    for (const c of text3) {
      window.setCharacter(c);
    }

    // There should be two spaces between the words on the first row,
    // and then the last row with text should appear 3 linebreaks later.
    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createDefaultCue(startTime, endTime, text1+'  '+text2),
      CeaUtils.createLineBreakCue(startTime, endTime),
      CeaUtils.createLineBreakCue(startTime, endTime),
      CeaUtils.createLineBreakCue(startTime, endTime),
      CeaUtils.createDefaultCue(startTime, endTime, text3),
    ];
    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };
    expect(caption).toEqual(expectedCaption);
  });

  it('cuts off text that exceeds the column size on a given row', () => {
    const text = '0123456789012345678901234567890123'; // this text is 34 chars.
    const trimmedText = text.substr(0, 32);
    for (const c of text) {
      window.setCharacter(c);
    }

    // Since column size is 32, the buffer should have only taken the first
    // 32 chars, and omitted the two extra ones at the end.
    const topLevelCue = CeaUtils.createWindowedCue(startTime, endTime, '',
        serviceNumber, 0, rowCount, colCount);
    topLevelCue.nestedCues = [
      CeaUtils.createDefaultCue(startTime, endTime, trimmedText),
    ];
    const caption = window.forceEmit(endTime, serviceNumber);
    const expectedCaption = {
      stream,
      cue: topLevelCue,
    };
    expect(caption).toEqual(expectedCaption);
  });


  it('correctly handles display(), hide(), and toggle() commands', () => {
    window.display(); // The window should be visible.
    expect(window.isVisible()).toBe(true);

    window.hide(); // The window should be hidden.
    expect(window.isVisible()).toBe(false);

    window.toggle(); // The window was hidden, but is now toggled to visible.
    expect(window.isVisible()).toBe(true);
  });

  describe('correctly handles the window anchors', () => {
    it('handles bottom of video window anchors', () => {
      window = new shaka.cea.Cea708Window(/* windowNum= */ 0,
          /* serviceNumber= */ 1);
      window.defineWindow(
          /* visible= */ true, /* verticalAnchor= */ 99,
          /* horAnchor= */ 50, /* anchorId= */ 7, /* relativeToggle= */ true,
          rowCount, colCount);
      window.setStartTime(startTime);

      const text = 'test word';
      for (const c of text) {
        window.setCharacter(c);
      }

      const topLevelCue = new shaka.text.Cue(startTime, endTime, '');
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];

      const caption = window.forceEmit(endTime, serviceNumber);

      const region = new shaka.text.CueRegion();
      region.id = 'svc1win0';
      region.height = rowCount;
      region.width = colCount;
      region.heightUnits = shaka.text.CueRegion.units.LINES;
      region.widthUnits = shaka.text.CueRegion.units.LINES;
      region.viewportAnchorX = 50;
      region.viewportAnchorY = 99;
      region.regionAnchorX = 50;
      region.regionAnchorY = 100;
      region.viewportAnchorUnits = shaka.text.CueRegion.units.PERCENTAGE;

      expect(caption.cue.region).toEqual(region);
    });

    it('handles top of video window anchors', () => {
      window = new shaka.cea.Cea708Window(/* windowNum= */ 0,
          /* serviceNumber= */ 2);
      window.defineWindow(
          /* visible= */ true, /* verticalAnchor= */ 0,
          /* horAnchor= */ 50, /* anchorId= */ 1, /* relativeToggle= */ true,
          rowCount, colCount);
      window.setStartTime(startTime);

      const text = 'test word';
      for (const c of text) {
        window.setCharacter(c);
      }

      const topLevelCue = new shaka.text.Cue(startTime, endTime, '');
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];

      const caption = window.forceEmit(endTime, serviceNumber);

      const region = new shaka.text.CueRegion();
      region.id = 'svc2win0';
      region.height = rowCount;
      region.width = colCount;
      region.heightUnits = shaka.text.CueRegion.units.LINES;
      region.widthUnits = shaka.text.CueRegion.units.LINES;
      region.viewportAnchorX = 50;
      region.viewportAnchorY = 0;
      region.regionAnchorX = 50;
      region.regionAnchorY = 0;
      region.viewportAnchorUnits = shaka.text.CueRegion.units.PERCENTAGE;

      expect(caption.cue.region).toEqual(region);
    });

    it('handles bottom right of video window anchors using line values', () => {
      window = new shaka.cea.Cea708Window(/* windowNum= */ 0,
          /* serviceNumber= */ 3);
      window.defineWindow(
          /* visible= */ true, /* verticalAnchor= */ 74,
          /* horAnchor= */ 209, /* anchorId= */ 8, /* relativeToggle= */ false,
          rowCount, colCount);
      window.setStartTime(startTime);

      const text = 'test word';
      for (const c of text) {
        window.setCharacter(c);
      }

      const topLevelCue = new shaka.text.Cue(startTime, endTime, '');
      topLevelCue.nestedCues = [
        CeaUtils.createDefaultCue(startTime, endTime, text),
      ];

      const caption = window.forceEmit(endTime, serviceNumber);

      const region = new shaka.text.CueRegion();
      region.id = 'svc3win0';
      region.height = rowCount;
      region.width = colCount;
      region.heightUnits = shaka.text.CueRegion.units.LINES;
      region.widthUnits = shaka.text.CueRegion.units.LINES;
      region.viewportAnchorX = 209;
      region.viewportAnchorY = 74;
      region.regionAnchorX = 100;
      region.regionAnchorY = 100;
      region.viewportAnchorUnits = shaka.text.CueRegion.units.LINES;

      expect(caption.cue.region).toEqual(region);
    });
  });
});

