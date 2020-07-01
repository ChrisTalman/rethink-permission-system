'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
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
interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array<PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {};
type PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> = RangePermissionParameter <GenericPermissionType> | SubjectPermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>;
interface BasePermissionParameter
{
	/** At least one permission must be authorised, but not necessarily this one. */
	some?: boolean;
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
	/** All required permissions are authorised. */
	authorisedRequired: boolean;
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
	{domainId, userId, permissions}: {domainId: string, userId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}
)
{
	const query = generateQuery({domainId, userId, permissions, system: this});
	const authorised = await rethinkRun({query, options: {throwRuntime: false}}) as boolean;
	return authorised;
};

export function generateIsUserAuthorisedQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string, GenericPermissions extends PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, userId, permissions}: {domainId: string | RDatum <string>, userId: string | RDatum <string>, permissions: GenericPermissions | RDatum <GenericPermissions>}
)
{
	const query = generateQuery({domainId, userId, permissions, system: this});
	return query;
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
																	RethinkDB.or
																	(
																		evaluation('parameter').hasFields('some').eq(false),
																		evaluation('parameter')('some').eq(false)
																	),
																	evaluation('authorised').eq(false)
																)
															)
															.count()
															.eq(0),
														authorisedSome: evaluations
															.filter(evaluation => evaluation('authorised'))
															.count()
															.gt(0)
													}
												)
												.merge
												(
													(evaluation: RDatum <Omit <AggregatePermissionEvaluation, 'authorised' | 'negated'>>) =>
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