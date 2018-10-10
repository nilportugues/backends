const { ensureSignedIn } = require('@orbiting/backend-modules-auth')
const { findById, isEligible } = require('../../../lib/Voting')

module.exports = async (_, args, { pgdb, user: me, t, req }) => {
  ensureSignedIn(req, t)

  const { optionId } = args

  const transaction = await pgdb.transactionBegin()
  try {
    const votingOption = await transaction.public.votingOptions.findOne({ id: optionId })
    if (!votingOption) {
      throw new Error(t('api/voting/option/404'))
    }

    const now = new Date()
    const voting = await findById(votingOption.votingId)
    if (voting.beginDate > now) {
      throw new Error(t('api/voting/tooEarly'))
    }
    if (voting.endDate < now) {
      throw new Error(t('api/voting/tooLate'))
    }

    if (!(await isEligible(me.id, voting, transaction))) {
      throw new Error(t('api/voting/membershipRequired'))
    }

    // ensure user has not voted yet
    if (await transaction.public.ballots.findFirst({
      userId: me.id,
      votingId: voting.id
    })) {
      throw new Error(t('api/voting/alreadyVoted'))
    }

    await transaction.public.ballots.insert({
      votingId: voting.id,
      votingOptionId: optionId,
      userId: me.id
    })

    await transaction.transactionCommit()

    return voting
  } catch (e) {
    await transaction.transactionRollback()
    throw e
  }
}
