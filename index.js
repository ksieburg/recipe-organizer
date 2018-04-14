const alexaSDK = require('alexa-sdk');
const awsSDK = require('aws-sdk');

const appId = 'amzn1.ask.skill.d4d54bbf-af45-4901-81d9-4c7c85da9c8c';
const recipesTable = 'Recipes';
const docClient = new awsSDK
  .DynamoDB
  .DocumentClient();

const instructions = `Welcome to Recipe Organizer<break strength="medium" /> 
                      The following commands are available: add recipe, get recipe,
                      get all recipes, get a random recipe, and delete recipe. What 
                      would you like to do?`;

const handlers = {

  /**
   * Triggered when the user says "Alexa, open Recipe Organizer.
   */
  'LaunchRequest' () {
    this.emit(':ask', instructions);
  },

  /**
   * Adds a recipe to the current user's saved recipes.
   * Slots: RecipeName, RecipeLocation, LongOrQuick
   */
  'AddRecipeIntent' () {
    const {userId} = this.event.session.user;
    const {slots} = this.event.request.intent;

    // prompt for slot values and request a confirmation for each RecipeName
    if (!slots.RecipeName.value) {
      const slotToElicit = 'RecipeName';
      const speechOutput = 'What is the name of the recipe?';
      const repromptSpeech = 'Please tell me the name of the recipe';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    } else if (slots.RecipeName.confirmationStatus !== 'CONFIRMED') {

      if (slots.RecipeName.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'RecipeName';
        const speechOutput = `The name of the recipe is ${slots.RecipeName.value}, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'RecipeName';
      const speechOutput = 'What is the name of the recipe you would like to add?';
      const repromptSpeech = 'Please tell me the name of the recipe';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    // RecipeLocation
    if (!slots.RecipeLocation.value) {
      const slotToElicit = 'RecipeLocation';
      const speechOutput = 'Where can the recipe be found?';
      const repromptSpeech = 'Please give me a location where the recipe can be found.';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    } else if (slots.RecipeLocation.confirmationStatus !== 'CONFIRMED') {

      if (slots.RecipeLocation.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'RecipeLocation';
        const speechOutput = `The recipe location is ${slots.RecipeLocation.value}, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'RecipeLocation';
      const speechOutput = 'Where can the recipe be found?';
      const repromptSpeech = 'Please give me a location where the recipe can be found.';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    // LongOrQuick
    if (!slots.LongOrQuick.value) {
      const slotToElicit = 'LongOrQuick';
      const speechOutput = 'Is this a quick or long recipe to make?';
      const repromptSpeech = 'Is this a quick or long recipe to make?';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    } else if (slots.LongOrQuick.confirmationStatus !== 'CONFIRMED') {

      if (slots.LongOrQuick.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'LongOrQuick';
        const speechOutput = `This is a ${slots.LongOrQuick.value} recipe, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'LongOrQuick';
      const speechOutput = 'Is this a quick or long recipe to make?';
      const repromptSpeech = 'Is this a quick or long recipe to make?';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    // all slot values received and confirmed, now add the record to DynamoDB

    const name = slots.RecipeName.value;
    const location = slots.RecipeLocation.value;
    const isQuick = slots
      .LongOrQuick
      .value
      .toLowerCase() === 'quick';
    const dynamoParams = {
      TableName: recipesTable,
      Item: {
        Name: name,
        UserId: userId,
        Location: location,
        IsQuick: isQuick
      }
    };

    const checkIfRecipeExistsParams = {
      TableName: recipesTable,
      Key: {
        Name: name,
        UserId: userId
      }
    };

    console.log('Attempting to add recipe', dynamoParams);

    // query DynamoDB to see if the item exists first
    docClient
      .get(checkIfRecipeExistsParams)
      .promise()
      .then(data => {
        console.log('Get item succeeded', data);

        const recipe = data.Item;

        if (recipe) {
          const errorMsg = `Recipe ${name} already exists!`;
          this.emit(':tell', errorMsg);
          throw new Error(errorMsg);
        } else {
          // no match, add the recipe
          return docClient.put(dynamoParams, function (err, data) {
            if (err) {
              console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
            }
          });
        }
      })
      .then(data => {
        console.log('Add item succeeded', data);

        this.emit(':tell', `Recipe ${name} added!`);
      })
      .catch(err => {
        console.error(err);
      });
  },

  /**
   * Lists all saved recipes for the current user. The user can filter by quick or long recipes.
   * Slots: GetRecipeQuickOrLong
   */
  'GetAllRecipesIntent' () {
    const {userId} = this.event.session.user;
    const {slots} = this.event.request.intent;
    let output;

    // prompt for slot data if needed
    if (!slots.GetRecipeQuickOrLong.value) {
      const slotToElicit = 'GetRecipeQuickOrLong';
      const speechOutput = 'Would you like a quick or long recipe or do you not care?';
      const repromptSpeech = 'Would you like a quick or long recipe or do you not care?';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    const isQuick = slots
      .GetRecipeQuickOrLong
      .value
      .toLowerCase() === 'quick';
    const isLong = slots
      .GetRecipeQuickOrLong
      .value
      .toLowerCase() === 'long';
    const dynamoParams = {
      TableName: recipesTable
    };

    if (isQuick || isLong) {
      dynamoParams.FilterExpression = 'UserId = :user_id AND IsQuick = :is_quick';
      dynamoParams.ExpressionAttributeValues = {
        ':user_id': userId,
        ':is_quick': isQuick
      };
      output = `The following ${isQuick
        ? 'quick'
        : 'long'} recipes were found: <break strength="x-strong" />`;
    } else {
      dynamoParams.FilterExpression = 'UserId = :user_id';
      dynamoParams.ExpressionAttributeValues = {
        ':user_id': userId
      };
      output = 'The following recipes were found: <break strength="x-strong" />';
    }

    // query DynamoDB
    docClient
      .scan(dynamoParams)
      .promise()
      .then(data => {
        console.log('Read table succeeded!', data);

        if (data.Items && data.Items.length) {
          data
            .Items
            .forEach(item => {
              output += `${item.Name}<break strength="x-strong" />`;
            });
        } else {
          output = 'No recipes found!';
        }

        console.log('output', output);

        this.emit(':tell', output);
      })
      .catch(err => {
        console.error(err);
      });
  },

  /**
   * Reads the full info of the selected recipe.
   * Slots: RecipeName
   */
  'GetRecipeIntent' () {
    const {slots} = this.event.request.intent;

    // prompt for slot data if needed
    if (!slots.RecipeName.value) {
      const slotToElicit = 'RecipeName';
      const speechOutput = 'What is the name of the recipe?';
      const repromptSpeech = 'Please tell me the name of the recipe';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    const {userId} = this.event.session.user;
    const recipeName = slots.RecipeName.value;
    const dynamoParams = {
      TableName: recipesTable,
      Key: {
        Name: recipeName,
        UserId: userId
      }
    };

    console.log('Attempting to read data');

    // query DynamoDB
    docClient
      .get(dynamoParams)
      .promise()
      .then(data => {
        console.log('Get item succeeded', data);

        const recipe = data.Item;

        if (recipe) {
          this.emit(':tell', `Recipe ${recipeName} is located in ${recipe.Location} and it
                        is a ${recipe.IsQuick
            ? 'Quick'
            : 'Long'} recipe to make.`);
        } else {
          this.emit(':tell', `Recipe ${recipeName} not found!`);
        }
      })
      .catch(err => console.error(err));
  },

  /**
   * Gets a random saved recipe for this user. The user can filter by quick or long recipes.
   * Slots: GetRecipeQuickOrLong
   */
  'GetRandomRecipeIntent' () {
    const {slots} = this.event.request.intent;

    // prompt for slot data if needed
    if (!slots.GetRecipeQuickOrLong.value) {
      const slotToElicit = 'GetRecipeQuickOrLong';
      const speechOutput = 'Would you like a quick or long recipe or do you not care?';
      const repromptSpeech = 'I said, would you like a quick or long recipe or do you not care?';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    const quickOrLongSlotValue = slots
      .GetRecipeQuickOrLong
      .value
      .toLowerCase();
    const isQuick = quickOrLongSlotValue === 'quick';
    const isLong = quickOrLongSlotValue === 'long';
    const {userId} = this.event.session.user;
    const dynamoParams = {
      TableName: recipesTable,
      FilterExpression: 'UserId = :user_id',
      ExpressionAttributeValues: {
        ':user_id': userId
      }
    };

    if (isQuick || isLong) {
      dynamoParams.FilterExpression += ' AND IsQuick = :is_quick';
      dynamoParams.ExpressionAttributeValues[':is_quick'] = isQuick;
    }

    console.log('Attempting to read data');

    // query DynamoDB
    docClient
      .scan(dynamoParams)
      .promise()
      .then(data => {
        console.log('Read table succeeded!', data);

        const recipes = data.Items;

        if (!recipes.length) {
          this.emit(':tell', 'No recipes added.');
        } else {
          const randomNumber = Math.floor(Math.random() * recipes.length);
          const recipe = recipes[randomNumber];

          this.emit(':tell', `The lucky recipe is ${recipe.Name} <break time="500ms"/> and it is located in ${recipe.Location} and it is a ${recipe.IsQuick
            ? 'quick'
            : 'long'} recipe to make.`);
        }
      })
      .catch(err => console.error(err));
  },

  /**
   * Allow the user to delete one of their recipes.
   */
  'DeleteRecipeIntent' () {
    const {slots} = this.event.request.intent;

    // prompt for the recipe name if needed and then require a confirmation
    if (!slots.RecipeName.value) {
      const slotToElicit = 'RecipeName';
      const speechOutput = 'What is the name of the recipe you would like to delete?';
      const repromptSpeech = 'Please tell me the name of the recipe';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    } else if (slots.RecipeName.confirmationStatus !== 'CONFIRMED') {

      if (slots.RecipeName.confirmationStatus !== 'DENIED') {
        // slot status: unconfirmed
        const slotToConfirm = 'RecipeName';
        const speechOutput = `You would like to delete the recipe ${slots.RecipeName.value}, correct?`;
        const repromptSpeech = speechOutput;
        return this.emit(':confirmSlot', slotToConfirm, speechOutput, repromptSpeech);
      }

      // slot status: denied -> reprompt for slot data
      const slotToElicit = 'RecipeName';
      const speechOutput = 'What is the name of the recipe you would like to delete?';
      const repromptSpeech = 'Please tell me the name of the recipe';
      return this.emit(':elicitSlot', slotToElicit, speechOutput, repromptSpeech);
    }

    const {userId} = this.event.session.user;
    const recipeName = slots.RecipeName.value;
    const dynamoParams = {
      TableName: recipesTable,
      Key: {
        Name: recipeName,
        UserId: userId
      }
    };

    console.log('Attempting to read data');

    // query DynamoDB to see if the item exists first
    docClient
      .get(dynamoParams)
      .promise()
      .then(data => {
        console.log('Get item succeeded', data);

        const recipe = data.Item;

        if (recipe) {
          console.log('Attempting to delete data', data);
          return docClient.delete(dynamoParams, function (err, data) {
            if (err) {
              console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
              console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
            }
          });
        }

        const errorMsg = `Recipe ${recipeName} not found!`;
        this.emit(':tell', errorMsg);
        throw new Error(errorMsg);
      })
      .then(data => {
        console.log('Delete item succeeded', data);

        this.emit(':tell', `Recipe ${recipeName} deleted!`);
      })
      .catch(err => console.log(err));
  },

  'Unhandled' () {
    console.error('problem', this.event);
    this.emit(':ask', 'An unhandled problem occurred!');
  },

  'AMAZON.HelpIntent' () {
    const speechOutput = instructions;
    const reprompt = instructions;
    this.emit(':ask', speechOutput, reprompt);
  },

  'AMAZON.CancelIntent' () {
    this.emit(':tell', 'Goodbye!');
  },

  'AMAZON.StopIntent' () {
    this.emit(':tell', 'Goodbye!');
  }
};

exports.handler = function handler(event, context) {
  const alexa = alexaSDK.handler(event, context);
  alexa.appId = appId;
  alexa.registerHandlers(handlers);
  alexa.execute();
};