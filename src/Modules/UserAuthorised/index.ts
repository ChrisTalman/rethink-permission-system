'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
import { nanoid as nanoidSync } from 'nanoid';
import { nanoid } from 'nanoid/async';
import { run as rethinkRun } from '@chris-talman/rethink-utilities';

// Internal Modules
import { PermissionSystem } from 'src/Modules';
import { generateUserVariablesQuery } from 'src/Modules/UserVariables';
import { generateUserAuthorisedByRangeQuery } from './Range';
import { generateUserAuthorisedBySubjectQuery } from './Subject';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionTargetEntity } from 'src/Modules';
import { UserVariables } from 'src/Modules/UserVariables';
export interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array<PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {};
type PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> = RangePermissionParameter <GenericPermissionType> | SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>;
interface BasePermissionParameter
{
	/**
		At least one permission must be authorised, but not necessarily this one.
		Can be grouped by a `string`, requiring one permission with that `string` to be authorised.
	*/
	some?: boolean | string;
};
export interface RangePermissionParameter <GenericPermissionType extends string>
{
	range: RangePermissionParameterRange <GenericPermissionType>;
};
export interface RangePermissionParameterRange <GenericPermissionType extends string> extends BasePermissionParameter
{
	types: Array<GenericPermissionType>;
};
export interface SubjectPermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
{
	subject: SubjectPermissionParameterSubject <GenericPermissionType, GenericSubjectTargetEntityType>;
};
export interface SubjectPermissionParameterSubject <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends BasePermissionParameter
{
	type: GenericPermissionType;
	entity: PermissionTargetEntity <GenericSubjectTargetEntityType>;
};
export interface PermissionParameterEvaluation
{
	granted: boolean;
	negated: boolean;
	authorised: boolean;
	parameter: BasePermissionParameter;
};
export interface AggregatePermissionEvaluation
{
	evaluations: Array <PermissionParameterEvaluation>;
	/** All required permissions are authorised. */
	authorisedRequired: boolean;
	authorisedGroups: { [type: string]: [boolean]; };
	/** At least one permission is authorised. */
	authorisedSome: boolean;
	/** At least one permission is authorised, and if any are required, all of those are authorised. */
	authorised: boolean;
	negated: boolean;
};

/** Determines whether the user has at least one permission in a range of possible permission types. */
export async function isUserAuthorised <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permissions: rawPermissions}: {domainId: string, userId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}
)
{
	const permissions = await generatePermissionsWithGroupsAsync({rawPermissions, system: this});
	const query = generateQuery({domainId, userId, permissions, system: this});
	let authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
	if (!authorised && this.globalPermissions)
	{
		const query = generateQuery({domainId, userId, permissions: this.globalPermissions, system: this});
		authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
	};
	return authorised;
};

export function generateIsUserAuthorisedQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string, GenericPermissions extends PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permissions: rawPermissions}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, permissions: GenericPermissions}
)
{
	const permissions = generatePermissionsWithGroupsSync({rawPermissions, system: this});
	const query = RethinkDB
		.or
		(
			generateQuery({domainId, userId, permissions, system: this}),
			this.globalPermissions ? generateQuery({domainId, userId, permissions: this.globalPermissions, system: this}) : false
		);
	return query;
};

async function generatePermissionsWithGroupsAsync <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({rawPermissions, system}: {rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const someGroup = await nanoid(10);
	const permissions = generatePermissionsWithGroups({someGroup, rawPermissions, system});
	return permissions;
};

function generatePermissionsWithGroupsSync <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({rawPermissions, system}: {rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const someGroup = nanoidSync(10);
	const permissions = generatePermissionsWithGroups({someGroup, rawPermissions, system});
	return permissions;
};

function generatePermissionsWithGroups <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({someGroup, rawPermissions, system}: {someGroup: string, rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const permissions: typeof rawPermissions = [];
	for (let rawPermission of rawPermissions)
	{
		permissions.push(rawPermission);
		const groupPermissionTypes = new Set <GenericPermissionType> ();
		if (system.groupPermissions)
		{
			for (let [ groupPermissionType, groupPermissionMemberTypes ] of Object.entries(system.groupPermissions))
			{
				for (let groupPermissionMemberType of groupPermissionMemberTypes as Array <GenericPermissionType>)
				{
					if
					(
						'range' in rawPermission && rawPermission.range.types.includes(groupPermissionMemberType) ||
						'subject' in rawPermission && rawPermission.subject.type === groupPermissionMemberType
					)
					{
						groupPermissionTypes.add(groupPermissionType as GenericPermissionType);
					};
				};
			};
		};
		for (let groupPermissionType of groupPermissionTypes)
		{
			if ('range' in rawPermission)
			{
				const some = rawPermission.range.some === true ? true : someGroup;
				rawPermission.range.some = some;
				const permission = Object.assign({}, rawPermission);
				permission.range.some = some;
				permission.range.types = [... rawPermission.range.types, groupPermissionType];
			}
			else if ('subject' in rawPermission)
			{
				const some = rawPermission.subject.some === true ? true : someGroup;
				rawPermission.subject.some = some;
				const permission = Object.assign({}, rawPermission);
				permission.subject.some = some;
				permission.subject = Object.assign({}, permission.subject, {type: groupPermissionType});
				permissions.push(permission);
			}
			else
			{
				throw new Error(`Unexpected permission:\n${JSON.stringify(rawPermission)}`);
			};
		};
	};
	return permissions;
};

function generateQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string, GenericPermissions extends PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>>
(
	{domainId, userId, permissions, system}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, permissions: GenericPermissions | RDatum <GenericPermissions>, system: PermissionSystem <any, any, any, any>}
)
{
	const query = generateUserVariablesQuery({domainId, userId, system})
		.do
		(
			(variables: RDatum <UserVariables <any>>) => RethinkDB
				.or
				(
					system.queries.globalAuthorised ? system.queries.globalAuthorised({domainId, userId, user: variables('user')}) : false,
					RethinkDB.and
					(
						system.queries.organisationAuthorised ? system.queries.organisationAuthorised({domainId, userId, user: variables('user')}) : true,
						system.queries.userRoles({domainId, userId, user: variables('user')})
							.do
							(
								(userRoles: ReturnType<typeof system.queries.userRoles>) =>
								(
									RethinkDB
										.expr(permissions)
										.map
										(
											permission => RethinkDB
												.branch
												(
													permission.hasFields('range'),
													generateUserAuthorisedByRangeQuery
													(
														{
															domainId,
															userRoles,
															permissions: (permission as unknown as RDatum <RangePermissionParameter <GenericPermissionType>>)('range')('types'),
															parameter: permission as unknown as RDatum <RangePermissionParameter <GenericPermissionType>>,
															system
														}
													),
													permission.hasFields('subject'),
													generateUserAuthorisedBySubjectQuery
													(
														{
															domainId,
															userRoles,
															permission: (permission as unknown as RDatum <SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>>)('subject')('type'),
															subject: (permission as unknown as RDatum <SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>>)('subject')('entity'),
															parameter: permission as unknown as RDatum <SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>>,
															system
														}
													),
													RethinkDB.error(`Expected properties 'range' or 'subject', but got neither`)
												)
										)
										.do
										(
											(evaluations: RDatum <Array <PermissionParameterEvaluation>>) => RethinkDB
												.expr
												(
													{
														authorisedRequired: evaluations
															.filter
															(
																evaluation => RethinkDB.and
																(
																	RethinkDB
																		.branch
																		(
																			evaluation('parameter').hasFields('range'),
																			evaluation('parameter')('range')('some').default(false).eq(false),
																			evaluation('parameter')('subject')('some').default(false).eq(false)
																		),
																	evaluation('authorised').eq(false)
																)
															)
															.count()
															.eq(0),
														authorisedGroups: evaluations
															.fold
															(
																{},
																(accumulator, evaluation) => accumulator
																	.merge
																	(
																		RethinkDB
																			.branch
																			(
																				RethinkDB.and
																				(
																					evaluation('parameter').hasFields({range: 'some'} as any),
																					evaluation('parameter')('range')('some').typeOf().eq('STRING')
																				),
																				evaluation('parameter')('range')('some'),
																				RethinkDB.and
																				(
																					evaluation('parameter').hasFields({subject: 'some'} as any),
																					evaluation('parameter')('subject')('some').typeOf().eq('STRING')
																				),
																				evaluation('parameter')('subject')('some'),
																				null
																			)
																			.do
																			(
																				(some: RDatum <string | null>) => RethinkDB
																					.branch
																					(
																						some.typeOf().eq('STRING'),
																						RethinkDB
																							.expr
																							(
																								[[
																									some,
																									accumulator(some as any).default([]).append(evaluation('authorised'))
																								]]
																							)
																							.coerceTo('object'),
																						{}
																					)
																			)
																	)
															),
														evaluations
													}
												)
												.merge
												(
													(evaluation: RDatum <Omit <AggregatePermissionEvaluation, 'authorised' | 'negated' | 'authorisedSome'>>) =>
													(
														{
															authorisedSome: RethinkDB
																.and
																(
																	evaluation('evaluations')
																		.filter(evaluation => evaluation('authorised'))
																		.count()
																		.gt(0),
																	evaluation('authorisedGroups')
																		.keys()
																		.filter
																		(
																			key => evaluation('authorisedGroups')
																				(key)
																				.filter(evaluation => evaluation)
																				.count()
																				.eq(0)
																		)
																		.count()
																		.eq(0)
																)
														}
													)
												)
												.merge
												(
													(evaluation: RDatum <Omit <AggregatePermissionEvaluation, 'authorised' | 'negated' | 'authorisedGroups'>>) =>
													(
														{
															authorised: RethinkDB.and
															(
																evaluation('authorisedRequired'),
																evaluation('authorisedSome')
															),
															negated: evaluations
																.filter(evaluation => evaluation('negated'))
																.count()
																.gt(0)
														}
													)
												)
												.do
												(
													(
														(evaluation: RDatum <AggregatePermissionEvaluation>) => RethinkDB.and
														(
															evaluation('authorised').eq(true),
															evaluation('negated').eq(false)
														)
													) as RDatum <any>
												)
										)
								)
							)
					)
				)
		);
	return query;
};