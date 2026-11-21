const { handleTeamCommand } = require('../../utils/battleHelper');

module.exports = [
  // တိုက်ပွဲဝင် အကောင်ရွေးချယ်ခြင်း (Kteam / Kselect)
  {
    names: ['team', 'select'],
    async execute(message, args, user) {
      return handleTeamCommand(message, args, user);
    },
  },
];